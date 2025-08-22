import React from 'react';
import ReportPage from '../../components/reports/ReportPage';

const AdminReportsPage: React.FC = () => {
  return (
    <ReportPage userRole="admin" />
  );
};

export default AdminReportsPage;
