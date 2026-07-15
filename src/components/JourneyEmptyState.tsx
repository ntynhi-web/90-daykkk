import React from "react";
import { Plus, BookOpen, Briefcase, Heart, LineChart, Target } from "lucide-react";
import { GoalCategory, GoalIconName } from "../types";

export interface JourneyPreset {
  name: string;
  desiredOutcome: string;
  category: GoalCategory;
  icon: GoalIconName;
  accentColor: string;
  mainMetric: string;
  notes: string;
  milestones: Array<{
    title: string;
    targetValue: string;
    dueDate: string;
  }>;
}

export const JOURNEY_PRESETS: Record<string, JourneyPreset> = {
  business: {
    name: "Phát triển công việc kinh doanh",
    desiredOutcome: "Đạt mốc doanh số mong muốn và tiếp cận ít nhất 50 đối tác mới.",
    category: "business",
    icon: "briefcase",
    accentColor: "indigo",
    mainMetric: "Số đối tác & Doanh số",
    notes: "Tập trung xây dựng giá trị cốt lõi và tối ưu phễu chuyển đổi.",
    milestones: [
      { title: "Thiết lập danh sách ICP & Offer", targetValue: "Hoàn thành", dueDate: "2026-08-01" },
      { title: "Tiếp cận 50 leads chất lượng cao", targetValue: "50 email", dueDate: "2026-08-25" },
      { title: "Đạt hợp đồng pilot trả phí đầu tiên", targetValue: "1 khách hàng", dueDate: "2026-09-15" }
    ]
  },
  health: {
    name: "Cải thiện sức khỏe & Ngoại hình",
    desiredOutcome: "Giảm cân an toàn từ 64 kg về 55 kg, hình thành lối sống năng động lành mạnh.",
    category: "health",
    icon: "heart",
    accentColor: "rose",
    mainMetric: "Cân nặng (kg)",
    notes: "Ưu tiên ăn thâm hụt calo nhẹ nhàng, đi bộ và skincare đều đặn.",
    milestones: [
      { title: "Giảm cân giai đoạn 1 về mốc 61kg", targetValue: "61 kg", dueDate: "2026-08-10" },
      { title: "Duy trì tập luyện thể chất hàng tuần", targetValue: "20 buổi", dueDate: "2026-09-15" },
      { title: "Đạt mục tiêu cân nặng 55kg thành công", targetValue: "55 kg", dueDate: "2026-10-10" }
    ]
  },
  skills: {
    name: "Hệ thống Fund & Backtest kỹ năng",
    desiredOutcome: "Hoàn thành 100 backtest có kỷ luật trước khi tham gia thi quỹ chuyên nghiệp.",
    category: "fund_backtest",
    icon: "chart",
    accentColor: "blue",
    mainMetric: "Số lệnh Backtest",
    notes: "Ghi chép nhật ký đầy đủ và tuyệt đối quản lý rủi ro.",
    milestones: [
      { title: "Thiết lập hệ thống & Quản lý rủi ro", targetValue: "Hoàn thành", dueDate: "2026-07-28" },
      { title: "Hoàn thành 50 backtests demo", targetValue: "50 backtests", dueDate: "2026-08-25" },
      { title: "Đạt mốc 100 backtests hoàn chỉnh", targetValue: "100 backtests", dueDate: "2026-09-20" }
    ]
  }
};

interface JourneyEmptyStateProps {
  onCreateClick: () => void;
  onSelectExample: (preset: JourneyPreset) => void;
}

export default function JourneyEmptyState({ onCreateClick, onSelectExample }: JourneyEmptyStateProps) {
  return (
    <div id="journey-empty-state" className="bg-white border border-slate-200 rounded-[24px] p-8 md:p-12 text-center max-w-3xl mx-auto space-y-8 shadow-xs">
      <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100">
        <Target className="w-8 h-8" />
      </div>

      <div className="space-y-3">
        <h3 className="font-display font-extrabold text-2xl md:text-3xl text-slate-900 tracking-tight">
          Bạn muốn đạt được điều gì trong 90 ngày tới?
        </h3>
        <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
          Tạo hành trình đầu tiên, chia mục tiêu thành các chặng nhỏ và lên lịch hành động để đo lường tiến độ một cách khoa học.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={onCreateClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:shadow"
        >
          <Plus className="w-4 h-4" />
          Tạo hành trình đầu tiên
        </button>
        <button
          onClick={() => onSelectExample(JOURNEY_PRESETS.business)}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-slate-400" />
          Xem mục tiêu mẫu
        </button>
      </div>

      <div className="pt-6 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">MỤC TIÊU GỢI Ý CHO BẠN</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Example 1: Business */}
          <div 
            onClick={() => onSelectExample(JOURNEY_PRESETS.business)}
            className="p-5 border border-slate-200 hover:border-indigo-400 hover:shadow-xs rounded-2xl text-left bg-slate-50/50 cursor-pointer transition-all space-y-3 group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">Phát triển công việc</h4>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">Tạo dịch vụ B2B, đạt doanh số & outreach.</p>
            </div>
          </div>

          {/* Example 2: Health */}
          <div 
            onClick={() => onSelectExample(JOURNEY_PRESETS.health)}
            className="p-5 border border-slate-200 hover:border-rose-400 hover:shadow-xs rounded-2xl text-left bg-slate-50/50 cursor-pointer transition-all space-y-3 group"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-rose-600 transition-colors">Cải thiện sức khỏe</h4>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">Giảm cân an toàn, thói quen thể chất, ăn uống sạch.</p>
            </div>
          </div>

          {/* Example 3: Skills */}
          <div 
            onClick={() => onSelectExample(JOURNEY_PRESETS.skills)}
            className="p-5 border border-slate-200 hover:border-blue-400 hover:shadow-xs rounded-2xl text-left bg-slate-50/50 cursor-pointer transition-all space-y-3 group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <LineChart className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">Xây dựng kỹ năng</h4>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">Hoàn thành 100 backtest, rèn luyện tính kỷ luật.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
