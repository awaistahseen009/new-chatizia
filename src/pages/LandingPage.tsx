import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  Bot, 
  MessageSquare, 
  Zap, 
  Shield, 
  Globe, 
  BarChart3,
  CheckCircle,
  Star,
  ArrowRight,
  Play,
  Users,
  Clock,
  Brain,
  Sparkles,
  FileText,
  Settings,
  Headphones
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const LandingPage: React.FC = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero animations
      gsap.fromTo('.hero-title', 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
      );

      gsap.fromTo('.hero-subtitle', 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, delay: 0.2, ease: 'power3.out' }
      );

      gsap.fromTo('.hero-buttons', 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, delay: 0.4, ease: 'power3.out' }
      );

      gsap.fromTo('.hero-image', 
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 1.2, delay: 0.6, ease: 'power3.out' }
      );

      // Features animation
      gsap.fromTo('.feature-card', 
        { opacity: 0, y: 50 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.8, 
          stagger: 0.1,
          scrollTrigger: {
            trigger: featuresRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // Demo animation
      gsap.fromTo('.demo-image', 
        { opacity: 0, x: -50 },
        { 
          opacity: 1, 
          x: 0, 
          duration: 0.8,
          stagger: 0.2,
          scrollTrigger: {
            trigger: demoRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // Analytics animation
      gsap.fromTo('.analytics-card', 
        { opacity: 0, scale: 0.8 },
        { 
          opacity: 1, 
          scale: 1, 
          duration: 0.6,
          stagger: 0.1,
          scrollTrigger: {
            trigger: analyticsRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // CTA animation
      gsap.fromTo('.cta-content', 
        { opacity: 0, y: 30 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.8,
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // Floating animation
      gsap.to('.floating', {
        y: -10,
        duration: 2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const features = [
    {
      icon: Bot,
      title: 'Easy to Manage Chatbots',
      description: 'Create and manage multiple AI chatbots from a single, intuitive dashboard.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Chatbots.PNG',
      color: 'blue'
    },
    {
      icon: FileText,
      title: 'Smart Templates',
      description: 'Choose from pre-built templates to get your chatbot up and running quickly.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/easy%20to%20go%20templates.PNG',
      color: 'purple'
    },
    {
      icon: Settings,
      title: 'Fully Configurable',
      description: 'Customize every aspect of your chatbot to match your brand perfectly.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Fully%20configurable.PNG',
      color: 'green'
    },
    {
      icon: Shield,
      title: 'Domain Security',
      description: 'Restrict chatbot access with domain whitelisting and enhanced security.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Domain%20Restrictness.PNG',
      color: 'red'
    },
    {
      icon: Headphones,
      title: 'Voice Interaction',
      description: 'Enable voice-based conversations with high-quality speech recognition.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Voice%20-1.PNG',
      color: 'indigo'
    },
    {
      icon: Zap,
      title: 'On-the-Fly Updates',
      description: 'Make real-time changes and deploy updates instantly.',
      image: 'https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/On%20the%20fly.PNG',
      color: 'orange'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-800">ChatBot Pro</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-800 transition-colors">Features</a>
              <a href="#demo" className="text-gray-600 hover:text-gray-800 transition-colors">Demo</a>
              <a href="#analytics" className="text-gray-600 hover:text-gray-800 transition-colors">Analytics</a>
              <Link to="/signin" className="text-gray-600 hover:text-gray-800 transition-colors">Sign In</Link>
              <Link to="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="pt-24 pb-20 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="hero-title text-5xl lg:text-6xl font-bold text-gray-800 leading-tight">
                Build Powerful <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI Chatbots</span> in Minutes
              </h1>
              <p className="hero-subtitle text-xl text-gray-600 mt-6 leading-relaxed">
                Create enterprise-grade AI chatbots with voice support, real-time analytics, and domain security.
              </p>
              <div className="hero-buttons flex flex-col sm:flex-row gap-4 mt-8">
                <Link to="/signup" className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl">
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <button className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2">
                  <Play className="w-5 h-5" />
                  <span>Watch Demo</span>
                </button>
              </div>
              <div className="flex items-center space-x-6 mt-8 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>14-day free trial</span>
                </div>
              </div>
            </div>
            <div className="hero-image floating">
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  <img 
                    src="https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/dashboard.PNG" 
                    alt="ChatBot Pro Dashboard" 
                    className="w-full h-auto"
                  />
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-green-500 to-blue-500 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">
              Comprehensive Chatbot Solutions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to create, manage, and deploy intelligent AI chatbots.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colorClasses = {
                blue: 'bg-blue-100 text-blue-600',
                purple: 'bg-purple-100 text-purple-600',
                green: 'bg-green-100 text-green-600',
                orange: 'bg-orange-100 text-orange-600',
                red: 'bg-red-100 text-red-600',
                indigo: 'bg-indigo-100 text-indigo-600'
              };
              return (
                <div key={index} className="feature-card bg-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 ${colorClasses[feature.color]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  <img src={feature.image} alt={feature.title} className="mt-6 w-full h-auto rounded-lg shadow-md" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section ref={demoRef} id="demo" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">
              Side-by-Side Demo Experience
            </h2>
            <p className="text-xl text-gray-600">
              Test your chatbot in real-time with our side-by-side demo interface.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="demo-image">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <img 
                  src="https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Live%20Side%20by%20side%20demo.PNG" 
                  alt="Side by Side Demo" 
                  className="w-full h-auto"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Live Demo Testing</h3>
                  <p className="text-gray-600">Preview and test your chatbot in real-time with side-by-side comparison.</p>
                </div>
              </div>
            </div>
            <div className="demo-image">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <img 
                  src="https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/pause%20and%20delete.PNG" 
                  alt="Pause and Delete" 
                  className="w-full h-auto"
                />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Easy Management</h3>
                  <p className="text-gray-600">Pause or delete chatbots with a single click for complete control.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section ref={analyticsRef} id="analytics" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">
              Comprehensive Analytics
            </h2>
            <p className="text-xl text-gray-600">
              Gain deep insights into your chatbot's performance and user interactions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="analytics-card bg-white rounded-2xl shadow-lg overflow-hidden">
              <img 
                src="https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/Complete%20Analytics.PNG" 
                alt="Complete Analytics" 
                className="w-full h-auto"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Real-Time Analytics</h3>
                <p className="text-gray-600">Track conversations, user engagement, and performance metrics instantly.</p>
              </div>
            </div>
            <div className="analytics-card bg-white rounded-2xl shadow-lg overflow-hidden">
              <img 
                src="https://jllducetdexpbblrrkdi.supabase.co/storage/v1/object/public/chatbot-logos/project/enhanced%20domain%20security.PNG" 
                alt="Enhanced Security" 
                className="w-full h-auto"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Enhanced Security</h3>
                <p className="text-gray-600">Protect your chatbot with advanced domain restriction features.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="cta-content">
            <h2 className="text-4xl font-bold text-white mb-6">
              Transform Your Customer Experience Today
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join thousands of businesses using ChatBot Pro to deliver exceptional AI-powered interactions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors inline-flex items-center justify-center space-x-2">
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">ChatBot Pro</span>
              </div>
              <p className="text-gray-400 mb-4">
                Build intelligent AI chatbots that transform customer experiences.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#demo" className="hover:text-white transition-colors">Demo</a></li>
                <li><a href="#analytics" className="hover:text-white transition-colors">Analytics</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© 2025 ChatBot Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;