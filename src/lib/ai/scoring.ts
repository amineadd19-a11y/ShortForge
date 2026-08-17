export type Platform = 'youtube' | 'tiktok' | 'reels';

export type ClipCandidate = {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  transcript: string;
  scores: { hook: number; clarity: number; payoff: number; retention: number; shareability: number };
  scoreReasons?: string[];
};

const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));
export const PLATFORM_WEIGHTS:Record<Platform,[number,number,number,number,number]>={youtube:[.24,.20,.21,.25,.10],tiktok:[.28,.16,.18,.25,.13],reels:[.25,.18,.20,.24,.13]};

export function scoreClip(candidate:ClipCandidate,platform:Platform):number{const {hook,clarity,payoff,retention,shareability}=candidate.scores;const [a,b,c,d,e]=PLATFORM_WEIGHTS[platform];return clamp(hook*a+clarity*b+payoff*c+retention*d+shareability*e);}

export function explainScore(candidate:ClipCandidate,platform:Platform):string[]{const s=candidate.scores;const reasons:string[]=[];if(s.hook>=70)reasons.push('Strong opening hook');if(s.retention>=70)reasons.push('Good retention profile');if(s.payoff>=70)reasons.push('Clear payoff potential');if(s.shareability>=70)reasons.push('High shareability signal');if(s.clarity>=70)reasons.push('Clear, easy-to-follow message');if(platform==='tiktok'&&s.hook>=65)reasons.push('Prioritizes fast hook for TikTok');if(platform==='youtube'&&s.retention>=65)reasons.push('Prioritizes sustained retention for Shorts');if(platform==='reels'&&s.shareability>=65)reasons.push('Prioritizes shareability for Reels');return reasons.length?reasons:['Balanced candidate across platform signals'];}

export function rankClips(candidates:ClipCandidate[],platform:Platform):ClipCandidate[]{return [...candidates].map(c=>({...c,scoreReasons:explainScore(c,platform)})).sort((a,b)=>scoreClip(b,platform)-scoreClip(a,platform));}
export function platformScores(candidate:ClipCandidate):Record<Platform,number>{return{youtube:scoreClip(candidate,'youtube'),tiktok:scoreClip(candidate,'tiktok'),reels:scoreClip(candidate,'reels')}}
