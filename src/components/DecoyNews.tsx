import React, { useState } from 'react';
import { Newspaper, ChevronRight, Share2, Heart, MessageSquare, ShieldAlert } from 'lucide-react';

interface DecoyNewsProps {
  onTriggerSOS: (reason: string) => void;
  onExitStealth: () => void;
}

export default function DecoyNews({ onTriggerSOS, onExitStealth }: DecoyNewsProps) {
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  const newsArticles = [
    {
      id: 1,
      category: 'GLOBAL ECONOMY',
      title: 'Central Banks Predict Steady Growth Rates for Upcoming Financial Quarter',
      summary: 'Market indices showed slight improvement as leading financial bodies highlighted positive consumer indexes and moderate inflation correction schedules.',
      content: 'Major stock indexes globally finished higher today as retail sales surged beyond expectations. Economists predict that the Federal Reserve may maintain interest levels to lock in standard growth figures, stabilizing supply chain nodes and improving credit yields globally. Domestic manufacturing outputs also hit an eighteen-month high, prompting analysts to elevate their ratings for long-term safe assets.',
      time: '12m ago',
      readTime: '4 min read',
      imgPlaceholder: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 2,
      category: 'TECHNOLOGY',
      title: 'New Eco-Friendly Computational Modules Enter High-Production Testing',
      summary: 'Researchers unveil custom micro-architecture utilizing solar-harvesting substrates designed to cut data storage grid consumption by up to 35 percent.',
      content: 'A joint coalition of engineering institutions has announced the first successful deployment of bio-silicon processing units. Unlike standard heat-retaining wafers, this technology channels active ambient temperature to perform state operations, reducing the reliance on massive dynamic cooling arrays. Production facilities are scaling lines to deploy these eco-computing blocks in consumer-facing mobile architectures by late next year.',
      time: '45m ago',
      readTime: '3 min read',
      imgPlaceholder: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400'
    },
    {
      id: 3,
      category: 'METROPOLITAN WEATHER',
      title: 'Moderate Cool Front Brings Scattered Light Showers and High Visibility',
      summary: 'Regional meteorology centers advise citizens to prepare for mild evening winds and a temporary drop of 4 to 6 degrees across regional urban valleys.',
      content: 'An high-pressure atmosphere sweeping from the northern coastlines will descend over metropolitan sectors tonight. Light cloud layers will disperse by sunrise, bringing crisp morning conditions. Humidity indices remain at standard autumn ratios. Winds will peak at 12 knots, making it ideal for outdoor activities, though local councils suggest light layers for high-altitude pathways.',
      time: '2h ago',
      readTime: '2 min read',
      imgPlaceholder: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&q=80&w=400'
    }
  ];

  const handleTitleClick = (id: number) => {
    // If user triple-clicks the main category/header on article 1, trigger SOS
    setSelectedArticle(id);
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-zinc-950 text-zinc-100 min-h-[500px] rounded-3xl border border-zinc-850 shadow-2xl p-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5 select-none">
        <div 
          className="flex items-center space-x-2 cursor-pointer"
          onDoubleClick={onExitStealth}
          title="Double-click to exit stealth mode"
        >
          <Newspaper className="w-5 h-5 text-emerald-500" />
          <span className="text-sm font-semibold uppercase tracking-widest font-display text-zinc-300">
            Chronicle Hub Live
          </span>
        </div>
        
        <button
          onClick={onExitStealth}
          className="px-3 py-1 bg-zinc-900 hover:bg-zinc-850 rounded-lg text-[11px] font-medium text-zinc-400 transition flex items-center space-x-1"
        >
          <span>Exit Reader</span>
        </button>
      </div>

      {selectedArticle === null ? (
        <div className="space-y-6">
          {/* Main Hero article */}
          <div 
            className="group cursor-pointer space-y-3"
            onClick={() => handleTitleClick(newsArticles[0].id)}
          >
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">
                {newsArticles[0].category}
              </span>
              <span className="text-zinc-600 text-xs">•</span>
              <span className="text-zinc-500 text-xs">{newsArticles[0].time}</span>
            </div>
            <h3 className="text-lg font-bold font-display group-hover:text-emerald-400 transition leading-snug">
              {newsArticles[0].title}
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2">
              {newsArticles[0].summary}
            </p>
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
              <span>{newsArticles[0].readTime}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>

          <div className="h-px bg-zinc-900 my-4" />

          {/* List articles */}
          <div className="space-y-4">
            {newsArticles.slice(1).map((article) => (
              <div 
                key={article.id}
                className="flex gap-4 items-start cursor-pointer hover:bg-zinc-900/40 p-2 -mx-2 rounded-xl transition"
                onClick={() => handleTitleClick(article.id)}
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">
                      {article.category}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 text-[10px]">{article.time}</span>
                  </div>
                  <h4 className="text-sm font-semibold leading-snug font-display text-zinc-200">
                    {article.title}
                  </h4>
                </div>
                {article.imgPlaceholder && (
                  <img 
                    src={article.imgPlaceholder} 
                    alt="news thumbnail"
                    className="w-16 h-16 rounded-lg object-cover grayscale opacity-70"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="h-px bg-zinc-900 my-4" />

          {/* Hidden Alarm Instructions on double tap logo */}
          <div className="bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-900 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Discreet Quick Emergency Trigger
              </span>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Double-tap the <strong className="text-emerald-500">emerald logo header</strong> at the top to return to the principal system. Triple-tap <strong className="text-zinc-300">any news headline</strong> to activate SOS silently.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-fadeIn">
          <button 
            onClick={() => setSelectedArticle(null)}
            className="text-xs text-emerald-500 hover:text-emerald-400 font-medium flex items-center space-x-1 mb-2"
          >
            <span>← Back to Feed</span>
          </button>

          {/* Detail View */}
          {(() => {
            const article = newsArticles.find(a => a.id === selectedArticle);
            if (!article) return null;
            return (
              <article className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">
                    {article.category}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500 text-xs">{article.time}</span>
                </div>
                
                <h2 className="text-xl font-bold font-display leading-tight">
                  {article.title}
                </h2>

                <div className="flex items-center space-x-4 text-xs text-zinc-500 border-y border-zinc-900 py-2.5">
                  <span>Written by Staff Reporter</span>
                  <span>•</span>
                  <span>{article.readTime}</span>
                </div>

                <p className="text-zinc-300 text-sm leading-relaxed font-sans first-letter:text-3xl first-letter:font-bold first-letter:mr-1 first-letter:float-left">
                  {article.content}
                </p>

                {/* Simulated Article Action Buttons: double-clicking safety icon triggers SOS */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                  <div className="flex items-center space-x-4 text-zinc-400 text-xs">
                    <button className="flex items-center space-x-1 hover:text-red-400 transition">
                      <Heart className="w-4 h-4" />
                      <span>42</span>
                    </button>
                    <button className="flex items-center space-x-1 hover:text-emerald-400 transition">
                      <MessageSquare className="w-4 h-4" />
                      <span>12</span>
                    </button>
                    <button className="flex items-center space-x-1 hover:text-zinc-200 transition">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Subtle SOS safety trigger inside article */}
                  <button 
                    onDoubleClick={() => onTriggerSOS(`Stealth News Safety Button double-clicked`)}
                    className="p-2 hover:bg-red-950/20 rounded-full text-zinc-700 hover:text-red-500 transition"
                    title="Double click in emergency"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })()}
        </div>
      )}
    </div>
  );
}
