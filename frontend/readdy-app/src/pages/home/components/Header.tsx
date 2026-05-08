import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-[#14B8A6] to-[#0F766E] rounded-lg">
              <i className="ri-leaf-line text-2xl text-white"></i>
            </div>
            <span className={`text-xl font-bold transition-colors ${isScrolled ? 'text-gray-900' : 'text-white'}`}>
              CaCalLab
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('features')}
              className={`text-base font-medium transition-colors hover:text-[#14B8A6] cursor-pointer whitespace-nowrap ${
                isScrolled ? 'text-gray-700' : 'text-white/90'
              }`}
            >
              產品功能
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className={`text-base font-medium transition-colors hover:text-[#14B8A6] cursor-pointer whitespace-nowrap ${
                isScrolled ? 'text-gray-700' : 'text-white/90'
              }`}
            >
              方案
            </button>
            <button
              onClick={() => scrollToSection('workflow')}
              className={`text-base font-medium transition-colors hover:text-[#14B8A6] cursor-pointer whitespace-nowrap ${
                isScrolled ? 'text-gray-700' : 'text-white/90'
              }`}
            >
              使用流程
            </button>
            <button
              onClick={() => scrollToSection('audience')}
              className={`text-base font-medium transition-colors hover:text-[#14B8A6] cursor-pointer whitespace-nowrap ${
                isScrolled ? 'text-gray-700' : 'text-white/90'
              }`}
            >
              適用對象
            </button>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className={`hidden md:inline-flex items-center px-6 py-2.5 text-base font-medium transition-colors rounded-full cursor-pointer whitespace-nowrap ${
                isScrolled
                  ? 'text-gray-700 hover:text-[#14B8A6]'
                  : 'text-white/90 hover:text-white'
              }`}
            >
              登入
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-[#14B8A6] hover:bg-[#0F766E] text-white px-6 py-2.5 rounded-full text-base font-medium transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer whitespace-nowrap"
            >
              免費試用
              <i className="ri-arrow-right-line text-lg"></i>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}