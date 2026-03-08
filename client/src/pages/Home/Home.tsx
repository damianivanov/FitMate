import HeroMain from './components/HeroMain';
import Features from './components/Features';
import FAQ from './components/FAQ';
import HomeFooter from './components/HomeFooter';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-between min-h-0">
      <div className="w-full max-w-6xl mx-auto px-4 pt-8 pb-16 md:px-6">
        <HeroMain />
        <Features />
        <FAQ />
      </div>
      <HomeFooter />
    </div>
  );
}
