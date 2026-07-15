import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Vercel invokes this Express app at /api. Preserve the requested sub-route
// from the rewrite query so /api/health, /api/classify, etc. reach Express.
app.use((req, _res, next) => {
  const rewrittenPath = req.query.__path;
  if (typeof rewrittenPath === "string" && req.path === "/api") {
    const queryIndex = req.url.indexOf("?");
    const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    req.url = `/api/${rewrittenPath}${queryString}`;
  }
  next();
});

// Helper to get current date/offset in Asia/Ho_Chi_Minh timezone
function getHoChiMinhDate(daysOffset = 0) {
  const date = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

// Initialize Gemini if key exists
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Gemini API Client initialized successfully.");
} else {
  console.warn("Warning: GEMINI_API_KEY is not set. AI Classification will run in fallback mode.");
}

// 8. GET /api/health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// GET /api/ai-status endpoint (preserving compatibility if front-end uses it)
app.get("/api/ai-status", (req, res) => {
  res.json({ configured: !!process.env.GEMINI_API_KEY });
});

// POST /api/classify endpoint
app.post("/api/classify", async (req, res) => {
  const { transcript, currentDate, goals = [], routines = [] } = req.body;

  const todayStr = currentDate || getHoChiMinhDate(0);

  // If GEMINI_API_KEY is not configured, return clear error JSON
  if (!aiClient) {
    return res.status(400).json({
      error: "AI_NOT_CONFIGURED",
      message: "Chức năng phân loại AI chưa được cấu hình.",
      transcript: transcript || ""
    });
  }

  // Filter active goals (journeys)
  const activeGoals = goals.filter((g: any) => g.status === "active");

  try {
    const prompt = `Bạn là trợ lý AI thông minh phân loại nhật ký bằng giọng nói và văn bản cho ứng dụng "90-Day Life OS".
Nhiệm vụ của bạn là phân tích đoạn nhật ký thô (transcript) của người dùng vào ngày hôm nay (${todayStr}) và trích xuất thành các phần cập nhật có cấu trúc dựa trên ngữ cảnh thực tế của họ dưới đây.

=== CÁC HÀNH TRÌNH MỤC TIÊU HIỆN TẠI (GOAL JOURNEYS) ===
${JSON.stringify(activeGoals.map((g: any) => ({
  id: g.id,
  name: g.name,
  description: g.description || g.desiredOutcome,
  milestones: (g.milestones || []).map((m: any) => ({ id: m.id, title: m.title, status: m.status, targetValue: m.targetValue, currentValue: m.currentValue }))
})), null, 2)}

=== CÁC THÓI QUEN ĐANG DUY TRÌ (ROUTINES) ===
${JSON.stringify(routines.map((r: any) => ({
  id: r.id,
  goalId: r.goalId,
  name: r.name,
  minimumDay: r.minimumDay,
  target: r.target
})), null, 2)}

=== QUY TẮC PHÂN TÍCH ===
1. CHIA NHỎ HOẠT ĐỘNG (activities): Hãy tách transcript thành các hoạt động nhỏ độc lập.
   - Tìm kiếm hành trình mục tiêu (goal/journey) phù hợp nhất bằng ID có sẵn.
   - Tuyệt đối không được tự sáng chế ra ID mới. Nếu hoạt động không liên quan đến hành trình nào, hãy đặt "journeyId" là null. Không tự động gán vào hành trình đầu tiên!
   - Gán "milestoneId" tương ứng nếu hoạt động cập nhật tiến độ cho cột mốc đó trong hành trình.

2. CẬP NHẬT CỘT MỐC (milestoneUpdates): Nếu người dùng thông báo đã hoàn thành hoặc đạt tiến độ mới cho mốc nào:
   - "suggestedStatus": Đặt là "completed" nếu mốc đã hoàn thành, hoặc giữ nguyên và cập nhật tiến độ.
   - Chỉ dùng ID cột mốc có sẵn trong dữ liệu truyền vào.

3. ĐỀ XUẤT CÔNG VIỆC MỚI (taskSuggestions): Nếu người dùng đề cập đến kế hoạch, việc muốn làm sắp tới (ví dụ: "Ngày mai tôi muốn làm..."):
   - Trích xuất tiêu đề, chọn priority phù hợp (important_urgent, important, urgent, later) và ước tính số phút estimatedMinutes.
   - Gán journeyId tương ứng hoặc null.

4. ĐỀ XUẤT LỊCH TRÌNH MỚI (scheduleSuggestions): Nếu người dùng muốn lên lịch, đặt giờ thực hiện việc gì (ví dụ: "ngày mai tôi muốn làm 10 backtest từ 9 giờ đến 10 giờ"):
   - Trích xuất title, date (định dạng YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM), và journeyId tương ứng hoặc null.

5. CẬP NHẬT THÓI QUEN (routineUpdates): Đối với mỗi thói quen (routine) của người dùng đã hoàn thành dựa trên mô tả nhật ký:
   - Cung cấp routineId, đặt suggestedStatus là "completed", kèm bằng chứng và độ tự tin.

6. Nếu độ tự tin hoặc độ chắc chắn thấp (confidence < 0.6), hãy hạ thấp confidence để hệ thống cảnh báo người dùng xác nhận thủ công. Không tự ý lưu các cập nhật chưa chắc chắn.

NỘI DUNG NHẬT KÝ (TRANSCRIPT):
"${transcript || ""}"

Hãy phân tích thật kỹ và trả về cấu trúc JSON khớp chính xác với responseSchema.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Tóm tắt ngắn gọn hoạt động" },
            activities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  activity: { type: Type.STRING },
                  journeyId: { type: Type.STRING, description: "ID của hành trình mục tiêu hoặc null", nullable: true },
                  milestoneId: { type: Type.STRING, description: "ID cột mốc liên quan hoặc null", nullable: true },
                  confidence: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["activity", "confidence", "evidence"]
              }
            },
            milestoneUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  journeyId: { type: Type.STRING },
                  milestoneId: { type: Type.STRING },
                  suggestedStatus: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["journeyId", "milestoneId", "suggestedStatus", "confidence", "evidence"]
              }
            },
            taskSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  journeyId: { type: Type.STRING, nullable: true },
                  priority: { type: Type.STRING },
                  estimatedMinutes: { type: Type.INTEGER }
                },
                required: ["title", "priority", "estimatedMinutes"]
              }
            },
            scheduleSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  date: { type: Type.STRING },
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  journeyId: { type: Type.STRING, nullable: true }
                },
                required: ["title", "date", "startTime", "endTime"]
              }
            },
            routineUpdates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  routineId: { type: Type.STRING },
                  suggestedStatus: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["routineId", "suggestedStatus", "confidence", "evidence"]
              }
            },
            unclassifiedItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "activities", "milestoneUpdates", "taskSuggestions", "scheduleSuggestions", "routineUpdates", "unclassifiedItems"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const data = JSON.parse(text);
    return res.json(data);
  } catch (error: any) {
    console.error("AI Classification Error:", error);
    return res.status(500).json({
      error: "AI_ERROR",
      message: "Gặp sự cố khi phân loại nhật ký bằng AI: " + error.message,
      transcript: transcript || ""
    });
  }
});

// POST /api/refine-transcript endpoint
app.post("/api/refine-transcript", async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "Không tìm thấy nội dung văn bản để hiệu đính." });
  }

  if (!aiClient) {
    // Fallback mode without API key - just return original
    return res.json({ refined: transcript });
  }

  try {
    const prompt = `Bạn là chuyên gia hiệu đính và sửa lỗi chính tả, nhận diện giọng nói tiếng Việt cho ứng dụng "90-Day Life OS".
Nhiệm vụ của bạn là sửa các lỗi chính tả, viết tắt, phát âm sai từ nhận diện giọng nói (Speech-to-Text) trong đoạn văn bản thô sau đây thành tiếng Việt chuẩn, mượt mà và tự nhiên nhất.

Yêu cầu cực kỳ quan trọng:
1. PHẢI giữ nguyên tất cả các con số, số liệu hoạt động, các mốc thời gian và ý nghĩa cốt lõi.
2. Sửa các từ phiên âm sai hoặc nói ngọng hoặc các thuật ngữ chuyên môn tiếng Anh thường viết sai trong tiếng Việt:
- "bờ hai bờ", "bờ hai bê", "be to be", "bờ hai bề" -> "B2B"
- "sa át", "sát", "sa-át" -> "SaaS"
- "em bét", "ao rít", "out rích", "ao rích" -> "Outreach"
- "trên đinh", "chay đinh", "trây đinh", "quỹ trây" -> "Trading"
- "viết tắt", "áp" -> "app"
- "bát test", "bách test", "bác tét", "bắc tét" -> "Batch Test"
- "bát phún", "phún", "quỹ kỷ luật" -> "Trading Fund"
- Sửa các chữ viết tay dạng chữ thành con số thực tế (ví dụ: "gửi mười lăm email" -> "gửi 15 email", "đi bộ sáu ngàn bước" -> "đi bộ 6000 bước", "sáu mươi ba phẩy tám cân" -> "63.8 kg", "đã nộp ba việc làm" -> "đã nộp 3 hồ sơ").

Văn bản thô cần hiệu đính:
"${transcript}"

Hãy trả về duy nhất văn bản kết quả đã được hiệu đính hoàn chỉnh, không kèm bất kỳ giải thích, tiêu đề hay từ ngữ dẫn dắt nào khác.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: prompt }]
    });

    const refinedText = response.text ? response.text.trim() : transcript;
    return res.json({ refined: refinedText });
  } catch (error: any) {
    console.error("AI Refine Transcript Error:", error);
    return res.status(500).json({ error: "Gặp lỗi khi hiệu đính văn bản: " + error.message });
  }
});

// POST /api/generate-recommendations endpoint
app.post("/api/generate-recommendations", async (req, res) => {
  const { state } = req.body;

  if (!state) {
    return res.status(400).json({ error: "State data is required." });
  }

  // Calculate local helpers for both AI and Fallback
  const goals = state.goals || [];
  const activities = state.activities || [];
  const healthRecords = state.healthRecords || {};
  const experiments = state.experiments || [];
  const history = state.evidenceRecommendations || [];

  const todayStr = getHoChiMinhDate(0);
  const oneWeekAgo = getHoChiMinhDate(-7);
  const twoWeeksAgo = getHoChiMinhDate(-14);

  const recentActivities7 = activities.filter((a: any) => a.date >= oneWeekAgo);
  const recentActivities14 = activities.filter((a: any) => a.date >= twoWeeksAgo);

  // Find neglected goals (no activities in last 3 days)
  const neglectedGoals = goals.filter((g: any) => {
    if (g.status !== "active") return false;
    const gActs = activities.filter((a: any) => a.goalId === g.id);
    if (gActs.length === 0) return true;
    const lastActDate = gActs[0].date; // assuming pre-sorted by newest
    const diffDays = Math.floor((Date.now() - new Date(lastActDate).getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 3;
  });

  // Calculate average energy in the last 7 days
  const recentHealth7 = Object.values(healthRecords).filter((h: any) => h.date >= oneWeekAgo);
  let totalEnergy = 0;
  for (const h of recentHealth7) {
    totalEnergy += Number((h as any).energy) || 0;
  }
  const averageEnergy = recentHealth7.length > 0 
    ? (totalEnergy / recentHealth7.length).toFixed(1)
    : "N/A";

  // Create highly customized rule-based fallback recommendations in Vietnamese
  const generateFallbackRecommendations = () => {
    const list = [];
    const fundGoal = goals.find((g: any) => g.category === "fund_backtest") || goals[0];
    const b2bGoal = goals.find((g: any) => g.category === "business" || g.category === "marketing") || goals[1];
    const healthGoal = goals.find((g: any) => g.category === "health") || goals[2];

    if (activities.length === 0) {
      list.push({
        goalId: goals[0]?.id || "G1",
        recommendedAction: "Thực hiện check-in đầu tiên để thiết lập dữ liệu cơ sở.",
        reason: "Hệ thống cần ít nhất một vài bản ghi hoạt động để có thể phân tích chính xác tiến độ và thói quen của bạn.",
        userEvidence: "Hiện tại hệ thống chưa ghi nhận bất kỳ hoạt động check-in nào trong chu kỳ này.",
        patternOrPrinciple: "Feedback loop relies entirely on baseline data collection (Vòng lặp phản hồi phụ thuộc hoàn toàn vào thu thập dữ liệu cơ sở).",
        expectedOutcome: "Xây dựng thói quen tự phản hồi và kích hoạt chỉ số đo lường.",
        successMetric: "Hoàn thành 1 bản ghi check-in giọng nói hoặc gõ chữ.",
        reviewDate: todayStr,
        confidence: "High",
        minimumDay: "Dùng giọng nói hoặc nhập tay 1 dòng nhật ký ngắn cho ngày hôm nay."
      });
    } else {
      // 1. Highest-priority Fund & Backtest recommendation
      const fundCount = recentActivities7.filter((a: any) => a.goalId === fundGoal?.id).length;
      list.push({
        goalId: fundGoal?.id || "G1",
        recommendedAction: "Hoàn thành một backtest đúng checklist và ghi lại bài học trong Trading Journal.",
        reason: "Fund & Backtest là hành trình ưu tiên cao nhất; tính nhất quán quan trọng hơn số lượng hoặc kết quả ngắn hạn.",
        userEvidence: `Dữ liệu 7 ngày qua ghi nhận ${fundCount} hoạt động thuộc Fund & Backtest.`,
        patternOrPrinciple: "Process consistency before outcome optimization (Ưu tiên tính nhất quán của quy trình trước khi tối ưu kết quả).",
        expectedOutcome: "Tăng chất lượng bộ dữ liệu và giảm quyết định cảm tính.",
        successMetric: "Hoàn thành 1 backtest với 100% mục trong checklist.",
        reviewDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        confidence: "High",
        minimumDay: "Mở Setup 1, kiểm tra một mẫu và ghi lại đúng 1 bài học."
      });

      // 2. Health / Well-being Recommendation
      const lowEnergyDays = recentHealth7.filter((h: any) => h.energy && h.energy <= 3).length;
      if (lowEnergyDays >= 2) {
        list.push({
          goalId: healthGoal?.id || "G3",
          recommendedAction: "Ưu tiên hồi phục năng lượng bằng cách ngủ đủ 7-8 tiếng và ngủ trước 23:30.",
          reason: "Năng lượng cơ thể là nền tảng cốt lõi cho mọi mục tiêu deep work. Bạn đang có dấu hiệu mệt mỏi.",
          userEvidence: `Ghi nhận ${lowEnergyDays} ngày có năng lượng ở mức trung bình/thấp (<= 3/5) trong tuần qua.`,
          patternOrPrinciple: "Strategic recovery prevents long-term burnout and decision fatigue (Hồi phục chiến lược giúp ngăn ngừa kiệt sức dài hạn và mệt mỏi quyết định).",
          expectedOutcome: "Khôi phục năng lượng cơ thể về mức tối ưu >= 4/5.",
          successMetric: "Đạt giấc ngủ sâu đủ 7.5 tiếng tối nay.",
          reviewDate: todayStr,
          confidence: "High",
          minimumDay: "Nghỉ ngơi sớm hơn 30 phút so với ngày hôm qua và thực hiện dưỡng da nhẹ."
        });
      } else {
        list.push({
          goalId: healthGoal?.id || "G3",
          recommendedAction: "Duy trì thói quen vận động nhẹ bằng cách đi bộ tối thiểu 6,000 bước hàng ngày.",
          reason: "Vận động thể chất nhẹ nhàng giúp duy trì tuần hoàn máu tốt, tỉnh táo tinh thần cho công việc trí óc.",
          userEvidence: `Ghi nhận trung bình năng lượng đạt ${averageEnergy}/5 trong tuần qua, thói quen đi bộ đang được duy trì tốt.`,
          patternOrPrinciple: "Non-exercise activity thermogenesis (NEAT) improves metabolic health and mental sharpness (Vận động không tập thể dục giúp tăng cường trao đổi chất và độ sắc bén tinh thần).",
          expectedOutcome: "Cơ thể khỏe mạnh, tăng sức tập trung làm việc.",
          successMetric: "Đạt 6,000 bước trên thiết bị theo dõi sức khỏe.",
          reviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          confidence: "High",
          minimumDay: "Đi bộ nhẹ nhàng 10 phút quanh khu vực làm việc (khoảng 3,000 bước)."
        });
      }

      // 3. Neglected Goal recovery
      if (neglectedGoals.length > 0) {
        const targetG = neglectedGoals[0];
        list.push({
          goalId: targetG.id,
          recommendedAction: `Thực hiện một hành động tối thiểu để khôi phục tiến độ mục tiêu: ${targetG.name}.`,
          reason: `Mục tiêu này đang bị chững lại và rơi vào trạng thái có nguy cơ bị bỏ quên.`,
          userEvidence: `Không ghi nhận bất kỳ hoạt động nào liên quan đến ${targetG.id} trong hơn 3 ngày qua.`,
          patternOrPrinciple: "The progress principle: Making minor headway daily boosts motivation (Nguyên lý tiến trình: Đạt tiến bộ nhỏ hàng ngày giúp gia tăng động lực).",
          expectedOutcome: "Phá vỡ sức ỳ, thiết lập lại nhịp độ hành động.",
          successMetric: "Ghi nhận 1 hoạt động nhỏ thuộc mục tiêu này hôm nay.",
          reviewDate: todayStr,
          confidence: "Medium",
          minimumDay: "Dành ra đúng 5 phút xem lại các mốc lịch trình hoặc tài liệu của mục tiêu này."
        });
      } else if (experiments.length > 0) {
        // Fallback option if no neglected goals: recommend review experiments
        const exp = experiments[0];
        list.push({
          goalId: exp.goalId,
          recommendedAction: `Đánh giá chỉ số đo lường chính của giả thuyết thử nghiệm: ${exp.hypothesis.slice(0, 40)}...`,
          reason: "Bạn đang chạy một thử nghiệm quan trọng. Đánh giá sớm giúp quyết định tiếp tục, tinh chỉnh hay dừng lại sớm.",
          userEvidence: `Thử nghiệm bắt đầu ngày ${exp.startDate} với chỉ số chính là ${exp.mainMetric}.`,
          patternOrPrinciple: "Lean scientific testing: Build-Measure-Learn feedback loop (Thử nghiệm khoa học tinh gọn: Vòng lặp Học - Đo lường - Xây dựng).",
          expectedOutcome: "Xác thực giả thuyết dựa trên dữ liệu thật.",
          successMetric: "Cập nhật quyết định tiếp tục/tinh chỉnh/dừng trong phần quản trị thử nghiệm.",
          reviewDate: exp.reviewDate,
          confidence: "High",
          minimumDay: "Kiểm tra nhanh số liệu phản hồi thô của thử nghiệm trong 5 phút."
        });
      } else {
        // B2B Marketing fallback recommendation
        list.push({
          goalId: b2bGoal?.id || "G2",
          recommendedAction: "Hoàn thiện một phần tài sản B2B đang hoạt động: Website, Social hoặc Portfolio.",
          reason: "Tài sản marketing rõ ràng giúp outreach đáng tin cậy hơn và rút ngắn thời gian giải thích dịch vụ.",
          userEvidence: `B2B Marketing hiện ở mức tiến độ ${b2bGoal?.currentProgress || 0}%.`,
          patternOrPrinciple: "Build proof before scaling outreach (Xây bằng chứng trước khi mở rộng tiếp cận).",
          expectedOutcome: "Tăng độ tin cậy của lời đề nghị B2B.",
          successMetric: "Xuất bản hoặc hoàn thiện 1 phần Website, Social hay Portfolio.",
          reviewDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          confidence: "Medium",
          minimumDay: "Viết một đoạn mô tả khách hàng mục tiêu và vấn đề bạn giải quyết."
        });
      }
    }

    return list.slice(0, 3);
  };

  if (!aiClient) {
    return res.json({ recommendations: generateFallbackRecommendations(), source: "fallback" });
  }

  try {
    const serializedData = {
      goals: goals.map((g: any) => ({ id: g.id, name: g.name, desiredOutcome: g.desiredOutcome, priority: g.priority, progress: g.currentProgress, deadline: g.deadline })),
      recentActivities7: recentActivities7.map((a: any) => ({ date: a.date, goalId: a.goalId, activity: a.activity, output: a.output, outcome: a.outcome })),
      recentActivities14: recentActivities14.map((a: any) => ({ date: a.date, goalId: a.goalId, activity: a.activity, output: a.output, outcome: a.outcome })),
      neglectedGoals: neglectedGoals.map((g: any) => ({ id: g.id, name: g.name })),
      experiments: experiments.map((e: any) => ({ id: e.id, hypothesis: e.hypothesis, mainMetric: e.mainMetric, startDate: e.startDate, reviewDate: e.reviewDate, decision: e.decision })),
      averageEnergy7Days: averageEnergy,
      historyOfDecisions: history.map((h: any) => ({ action: h.recommendedAction, status: h.status, notes: h.decisionNotes || "" }))
    };

    const prompt = `Bạn là trợ lý phân tích dữ liệu hiệu năng cao và là động cơ đề xuất hành động tối ưu (Evidence-Based Recommendation Engine) cho ứng dụng quản trị cá nhân "90-Day Life OS".
Nhiệm vụ của bạn là phân tích dữ liệu thực tế hiện tại của người dùng và tạo ra TỐI ĐA 3 đề xuất hành động tốt nhất tiếp theo để họ thực hiện trong ngày tiếp theo.

Hãy sử dụng các dữ liệu đầu vào sau đây được cung cấp dưới dạng JSON:
${JSON.stringify(serializedData, null, 2)}

Yêu cầu cực kỳ quan trọng và nghiêm ngặt khi đề xuất:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT HOẶC TỰ VẼ RA số liệu người dùng chưa có. Tất cả bằng chứng người dùng (userEvidence) phải dựa hoàn toàn vào dữ liệu thô cung cấp ở trên (ví dụ: số lần check-in, số bước chân trung bình, số email đã gửi được ghi nhận trong activities, v.v.).
2. KHÔNG khẳng định hoặc tự phong bất kỳ đề xuất nào là "đã chứng minh là đúng hoàn toàn" khi không có nguồn nguyên lý khoa học, thói quen quản trị hay các mô hình năng suất thực chứng rõ ràng và vững chãi.
3. PHÂN BIỆT RÕ RÀNG ba yếu tố trong nội dung trả về:
   - Bằng chứng thực tế của người dùng (userEvidence): chỉ rõ họ đã làm gì/chưa làm gì, con số cụ thể trong 7-14 ngày qua.
   - Nguyên lý / Quy luật năng suất / Thói quen khoa học (patternOrPrinciple): tên và mô tả ngắn gọn một nguyên lý/mô hình nổi tiếng (ví dụ: Nguyên lý 1% cải thiện hàng ngày, Nguyên lý Pareto 80/20, Thử nghiệm khoa học tinh gọn Lean Build-Measure-Learn, Hồi phục chủ động Active Recovery, v.v.).
   - Suy luận AI (AI Inference): lý giải logic tại sao nguyên lý đó áp dụng vào bằng chứng người dùng hiện tại lại sinh ra đề xuất này.
4. KHÔNG ĐƯỢC tự động thay đổi mục tiêu, cột mốc (milestones) hay các thói quen hàng ngày (routines) của người dùng. Hãy đề xuất hành động thực thi cụ thể.
5. Nếu dữ liệu hiện tại quá ít hoặc trống (ví dụ: không có activities hoặc quá ít), hãy tạo đề xuất hành động khuyên họ tập trung thu thập dữ liệu cơ sở trước (ghi nhật ký 3 ngày liên tục, đi bộ nhẹ...) để hệ thống có cơ sở phân tích sâu hơn.
6. TUYỆT ĐỐI tránh các lời khuyên y tế, tài chính, đầu tư hay các rủi ro sức khỏe. Nếu người dùng mệt mỏi, mệt nhọc kéo dài hay mỏi cơ (nhận thấy qua energy thấp), chỉ khuyên hồi phục tự nhiên, ngủ nghỉ và giãn cơ nhẹ nhàng.
7. Giải thích mọi thứ bằng TIẾNG VIỆT ĐƠN GIẢN, gãy gọn, tinh tế và dễ hiểu cho người dùng Việt Nam.
8. Trả về đúng 1 mảng JSON chứa tối đa 3 đề xuất với cấu trúc chi tiết được định nghĩa trong responseSchema.

Hãy thực hiện phân tích logic, khách quan, chính xác để đưa ra kết quả.`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of up to 3 evidence-based next-action recommendations.",
          items: {
            type: Type.OBJECT,
            properties: {
              goalId: { type: Type.STRING, description: "ID của mục tiêu liên quan như 'G1', 'G2', 'G3', 'G4', 'G5' hoặc 'other'" },
              recommendedAction: { type: Type.STRING, description: "Hành động cụ thể khuyên người dùng nên làm tiếp theo" },
              reason: { type: Type.STRING, description: "Lý do chi tiết tại sao hành động này quan trọng ngay lúc này" },
              userEvidence: { type: Type.STRING, description: "Bằng chứng thực tế trích xuất từ dữ liệu của người dùng hỗ trợ đề xuất này (Ví dụ: Bạn đã làm X lần, chưa làm Y trong 14 ngày qua, mức năng lượng Z...)" },
              patternOrPrinciple: { type: Type.STRING, description: "Nguyên lý khoa học hoặc quy luật năng suất đã được công nhận liên quan" },
              expectedOutcome: { type: Type.STRING, description: "Kết quả mong đợi đạt được sau khi thực hiện hành động này" },
              successMetric: { type: Type.STRING, description: "Chỉ số cụ thể để đo lường xem hành động đã hoàn thành thành công hay chưa" },
              reviewDate: { type: Type.STRING, description: "Ngày để đánh giá lại đề xuất này dạng YYYY-MM-DD" },
              confidence: { type: Type.STRING, description: "Độ tin cậy của đề xuất: 'Low', 'Medium' hoặc 'High'" },
              minimumDay: { type: Type.STRING, description: "Hành động thay thế siêu tối thiểu (Minimum Day) phòng khi người dùng thiếu thời gian hoặc năng lượng" }
            },
            required: [
              "goalId", "recommendedAction", "reason", "userEvidence", "patternOrPrinciple", "expectedOutcome", "successMetric", "reviewDate", "confidence", "minimumDay"
            ]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned empty text.");
    }

    const data = JSON.parse(text);
    return res.json({ recommendations: data, source: "gemini" });
  } catch (error: any) {
    console.error("AI Recommendation Generation Error:", error);
    // Silent failover to fallback recommendations
    return res.json({ recommendations: generateFallbackRecommendations(), source: "fallback-error" });
  }
});

// POST /api/coach — one focused agent with three expert lenses.
// It uses only the user's Life OS context; no web search or invented benchmarks.
app.post("/api/coach", async (req, res) => {
  const { question, state } = req.body || {};

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "QUESTION_REQUIRED", message: "Hãy nhập câu hỏi cần Life OS Coach tư vấn." });
  }
  if (!aiClient) {
    return res.status(400).json({ error: "AI_NOT_CONFIGURED", message: "Life OS Coach chưa được cấu hình." });
  }

  const compactContext = {
    goals: (state?.goals || []).filter((g: any) => g.status === "active").map((g: any) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      desiredOutcome: g.desiredOutcome,
      currentProgress: g.currentProgress,
      nextAction: g.nextAction,
      milestones: (g.milestones || []).map((m: any) => ({
        id: m.id, title: m.title, targetValue: m.targetValue, currentValue: m.currentValue, status: m.status, dueDate: m.dueDate
      }))
    })),
    routines: (state?.routines || []).map((r: any) => ({ id: r.id, goalId: r.goalId, name: r.name, status: r.status, minimumDay: r.minimumDay, target: r.target })),
    recentActivities: (state?.activities || []).slice(0, 20),
    priorityTasks: (state?.priorityTasks || []).filter((t: any) => !t.completed).slice(0, 12),
    upcomingSchedule: (state?.scheduleItems || []).filter((s: any) => s.date >= getHoChiMinhDate(0)).slice(0, 12)
  };

  const prompt = `Bạn là Life OS Coach — một AI agent duy nhất có đúng 3 kỹ năng chuyên gia:
1) FUND & BACKTEST: quy trình backtest, kỷ luật checklist, chất lượng mẫu, journal và quản trị rủi ro. Không đưa tín hiệu mua/bán hay cam kết lợi nhuận.
2) B2B MARKETING: ICP, offer, website, social, portfolio, outreach, pipeline và chuyển đổi khách hàng.
3) HEALTH & BEAUTY: thói quen sức khỏe, giảm cân bền vững, vận động, giấc ngủ và skincare cơ bản. Không chẩn đoán hoặc thay thế bác sĩ.

NGUYÊN TẮC BẮT BUỘC:
- Chỉ dùng dữ liệu Life OS được cung cấp bên dưới. Không tìm kiếm web, không viện dẫn xu hướng chung, không bịa dữ liệu.
- Tự chọn một expertLens phù hợp; chỉ dùng cross_goal khi câu hỏi thực sự liên quan nhiều mục tiêu.
- Tư vấn cụ thể cho đúng milestone, thời gian, lịch và năng lượng của người dùng.
- Nếu thiếu dữ liệu quan trọng, nêu assumption và trả về một clarifyingQuestion ngắn thay vì đoán.
- Ưu tiên đúng một nextAction có thể làm trong hôm nay; kế hoạch tối đa 3 bước.
- Tách rõ dữ kiện của người dùng, suy luận và giới hạn/rủi ro.
- Trả lời bằng tiếng Việt ngắn gọn, trực tiếp, không dùng lời khuyên chung chung.

NGỮ CẢNH LIFE OS:
${JSON.stringify(compactContext, null, 2)}

CÂU HỎI:
"${question.trim()}"`;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expertLens: { type: Type.STRING, description: "fund_backtest, b2b_marketing, health_beauty hoặc cross_goal" },
            diagnosis: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            nextAction: { type: Type.STRING },
            plan: { type: Type.ARRAY, items: { type: Type.STRING } },
            successMetric: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            riskNote: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            clarifyingQuestion: { type: Type.STRING, nullable: true }
          },
          required: ["expertLens", "diagnosis", "recommendation", "nextAction", "plan", "successMetric", "reasoning", "riskNote", "confidence", "assumptions"]
        }
      }
    });
    if (!response.text) throw new Error("Gemini returned empty coach response.");
    return res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Life OS Coach Error:", error);
    return res.status(500).json({ error: "COACH_ERROR", message: "Life OS Coach gặp sự cố: " + error.message });
  }
});

export default app;
