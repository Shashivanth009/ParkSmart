import type { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  description?: string | ReactNode;
  children?: ReactNode; // For actions like a "Create New" button
}

export function PageTitle({ title, description, children }: PageTitleProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {children && <div className="md:ml-auto">{children}</div>}
      </div>
      {description && (
        <p className="mt-1 text-sm md:text-base text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
