interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "orange" | "red" | "blue" | "gray" | "yellow";
}

const variantClasses: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
  yellow: "bg-yellow-100 text-yellow-700",
};

export default function Badge({ children, variant = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
