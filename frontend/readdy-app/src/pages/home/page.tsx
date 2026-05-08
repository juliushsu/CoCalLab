import HeroSection from './components/HeroSection';
import ProblemsSection from './components/ProblemsSection';
import DocumentIntelligenceSection from './components/DocumentIntelligenceSection';
import FeaturesSection from './components/FeaturesSection';
import WorkflowSection from './components/WorkflowSection';
import AudienceSection from './components/AudienceSection';
import PricingSection from './components/PricingSection';
import AIRoadmapSection from './components/AIRoadmapSection';
import CTASection from './components/CTASection';
import Footer from './components/Footer';
import Header from './components/Header';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection />
      <ProblemsSection />
      <DocumentIntelligenceSection />
      <FeaturesSection />
      <WorkflowSection />
      <AudienceSection />
      <PricingSection />
      <AIRoadmapSection />
      <CTASection />
      <Footer />
    </div>
  );
}