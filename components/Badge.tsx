interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "orange" | "red" | "blue" | "gray" | "yellow";
}

const variantClasses: Record<string, string> = {
  green:  "bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-400",
  orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  red:    "bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400",
  blue:   "bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400",
  gray:   "bg-gray-100   dark:bg-slate-700     text-gray-600   dark:text-slate-300",
  yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
};

export default function Badge({ children, variant = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
