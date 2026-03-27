interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
