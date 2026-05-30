import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

const HomePage = lazy(() => import('../pages/home/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Admin - Organizations
const OrganizationListPage = lazy(() => import('../pages/admin/organizations/OrganizationListPage'));
const CreateOrganizationPage = lazy(() => import('../pages/admin/organizations/CreateOrganizationPage'));
const EditOrganizationPage = lazy(() => import('../pages/admin/organizations/EditOrganizationPage'));
const OrganizationMembersPage = lazy(() => import('../pages/admin/organizations/OrganizationMembersPage'));

// Admin - Projects
const ProjectListPage = lazy(() => import('../pages/admin/projects/ProjectListPage'));
const CreateProjectPage = lazy(() => import('../pages/admin/projects/CreateProjectPage'));
const EditProjectPage = lazy(() => import('../pages/admin/projects/EditProjectPage'));
const ProjectOverviewPage = lazy(() => import('../pages/admin/projects/ProjectOverviewPage'));

// Admin - Documents
const DocumentUploadPage = lazy(() => import('../pages/admin/documents/DocumentUploadPage'));
const UploadedDocumentListPage = lazy(() => import('../pages/admin/documents/UploadedDocumentListPage'));
const ExtractedDraftReviewPage = lazy(() => import('../pages/admin/documents/ExtractedDraftReviewPage'));

// Admin - Activities
const EmissionActivitiesListPage = lazy(() => import('../pages/admin/activities/EmissionActivitiesListPage'));
const EmissionActivityDetailPage = lazy(() => import('../pages/admin/activities/EmissionActivityDetailPage'));

const ReportPreviewPage = lazy(() => import('../pages/admin/reports/ReportPreviewPage'));
const ReportGenerationHistoryPage = lazy(() => import('../pages/admin/reports/ReportGenerationHistoryPage'));
const ReportCenterPage = lazy(() => import('../pages/admin/reports/ReportCenterPage'));

// Admin - Emission Factors
const EmissionFactorsPage = lazy(() => import('../pages/admin/emission-factors/EmissionFactorsPage'));
const FactorSourcesPage = lazy(() => import('../pages/admin/emission-factors/FactorSourcesPage'));

// Admin - Analytics
const EmissionsAnalyticsPage = lazy(() => import('../pages/admin/analytics/EmissionsAnalyticsPage'));

// Admin - AI Governance

// Admin - Carbon Adjustments
const CarbonAdjustmentsPage = lazy(() => import('../pages/admin/carbon-adjustments/CarbonAdjustmentsPage'));

const SubscriptionManagementPage = lazy(() => import('../pages/admin/subscription/SubscriptionManagementPage'));

// Auth Pages
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/admin/organizations',
    element: <ProtectedRoute><OrganizationListPage /></ProtectedRoute>,
  },
  {
    path: '/admin/organizations/create',
    element: <ProtectedRoute><CreateOrganizationPage /></ProtectedRoute>,
  },
  {
    path: '/admin/organizations/:id/members',
    element: <ProtectedRoute><OrganizationMembersPage /></ProtectedRoute>,
  },
  {
    path: '/admin/organizations/:id/edit',
    element: <ProtectedRoute><EditOrganizationPage /></ProtectedRoute>,
  },
  {
    path: '/admin/projects',
    element: <ProtectedRoute><ProjectListPage /></ProtectedRoute>,
  },
  {
    path: '/admin/projects/create',
    element: <ProtectedRoute><CreateProjectPage /></ProtectedRoute>,
  },
  {
    path: '/admin/projects/:id',
    element: <ProtectedRoute><ProjectOverviewPage /></ProtectedRoute>,
  },
  {
    path: '/admin/projects/:id/edit',
    element: <ProtectedRoute><EditProjectPage /></ProtectedRoute>,
  },
  {
    path: '/admin/documents',
    element: <Navigate to="/admin/documents/upload" replace />,
  },
  {
    path: '/admin/documents/upload',
    element: <ProtectedRoute><DocumentUploadPage /></ProtectedRoute>,
  },
  {
    path: '/admin/documents/list',
    element: <ProtectedRoute><UploadedDocumentListPage /></ProtectedRoute>,
  },
  {
    path: '/admin/documents/drafts',
    element: <ProtectedRoute><ExtractedDraftReviewPage /></ProtectedRoute>,
  },
  {
    path: '/admin/activities',
    element: <ProtectedRoute><EmissionActivitiesListPage /></ProtectedRoute>,
  },
  {
    path: '/admin/activities/:activityId',
    element: <ProtectedRoute><EmissionActivityDetailPage /></ProtectedRoute>,
  },
  {
    path: '/admin/reports',
    element: <ProtectedRoute><ReportCenterPage /></ProtectedRoute>,
  },
  {
    path: '/admin/reports/history',
    element: <ProtectedRoute><ReportGenerationHistoryPage /></ProtectedRoute>,
  },
  {
    path: '/admin/reports/esg',
    element: <ProtectedRoute><ReportCenterPage /></ProtectedRoute>,
  },
  {
    path: '/admin/reports/ifrs',
    element: <ProtectedRoute><ReportCenterPage /></ProtectedRoute>,
  },
  {
    path: '/admin/reports/:reportId',
    element: <ProtectedRoute><ReportPreviewPage /></ProtectedRoute>,
  },
  {
    path: '/admin/subscription',
    element: <ProtectedRoute><SubscriptionManagementPage /></ProtectedRoute>,
  },
  {
    path: '/admin/product-carbon',
    element: <NotFoundPage />,
  },
  {
    path: '/admin/emission-factors/list',
    element: <ProtectedRoute><EmissionFactorsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/emission-factors/sources',
    element: <ProtectedRoute><FactorSourcesPage /></ProtectedRoute>,
  },
  {
    path: '/admin/analytics',
    element: <ProtectedRoute><EmissionsAnalyticsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/ai-governance',
    element: <NotFoundPage />,
  },
  {
    path: '/admin/carbon-adjustments',
    element: <ProtectedRoute><CarbonAdjustmentsPage /></ProtectedRoute>,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export default routes;
