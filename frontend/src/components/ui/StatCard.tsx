import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  prefix?: string;
  suffix?: string;
}

export default function StatCard({ title, value, change, changeType = "neutral", icon: Icon, prefix, suffix }: StatCardProps) {
  const changeColors = {
    positive: "text-green-600 bg-green-50",
    negative: "text-red-600 bg-red-50",
    neutral: "text-gray-600 bg-gray-50",
  };

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{prefix}{value}{suffix}</p>
          {change && (
            <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-lg ${changeColors[changeType]}`}>{change}</span>
          )}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );
}
