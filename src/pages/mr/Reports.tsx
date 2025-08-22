import React from 'react';
import ReportPage from '../../components/reports/ReportPage';
// Removed import of AppLayout

const MRReportsPage: React.FC = () => {
  return (
    <ReportPage userRole="mr" />
  );
};

export default MRReportsPage;
