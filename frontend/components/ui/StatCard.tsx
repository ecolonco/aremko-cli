import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={clsx(
        'bg-white overflow-hidden shadow rounded-lg',
        className
      )}
    >
      <div className="p-5">
        <div className="flex items-center">
          {icon && (
            <div className="flex-shrink-0">
              <div className="rounded-md p-3 bg-blue-50">
                {icon}
              </div>
            </div>
          )}
          <div className={clsx('w-0 flex-1', icon && 'ml-5')}>
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {value}
                </div>
                {trend && (
                  <div
                    className={clsx(
                      'ml-2 flex items-baseline text-sm font-semibold',
                      trend.isPositive ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                  </div>
                )}
              </dd>
              {subtitle && (
                <dd className="mt-1 text-sm text-gray-500">{subtitle}</dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
