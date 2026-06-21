
import React from 'react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="flex items-center justify-center h-full p-4 sm:p-6 lg:p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-boh-text-light dark:text-boh-text">{title}</h1>
        <p className="mt-2 text-lg text-boh-text-sub-light dark:text-boh-text-sub">This page is under construction.</p>
        <code className="mt-4 inline-block bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub p-2 rounded-md">
          // TODO: Implement {title} page content
        </code>
      </div>
    </div>
  );
};

export default PlaceholderPage;
