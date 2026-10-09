import React from 'react';
import { PageSkeletonLoader } from './PageSkeletonLoader';

export const ViewSkeletonFallback: React.FC = () => {
  return <PageSkeletonLoader variant="generic" />;
};
