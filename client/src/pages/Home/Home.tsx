import HeroMain from './components/HeroMain';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import HomeFooter from './components/HomeFooter';

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between">
      <div className="w-full space-y-14 px-4 pb-16 pt-6 md:space-y-20 md:pt-20 min-[1920px]:mx-auto min-[1920px]:w-[75%]">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <HeroMain />
          <div className="space-y-14 md:space-y-20">
            <Features />
            <HowItWorks />
          </div>
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}
