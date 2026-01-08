import React from 'react';
import { PetType, PetStage } from '../types';
import { PET_EMOJIS } from '../constants';

// Import BABY stage avatars
import sharkwowBaby from '../assets/avatars/sharkwow.png';
import squirtleBaby from '../assets/avatars/squirtle.png';
import stitchBaby from '../assets/avatars/stitch.png';
import ducksonBaby from '../assets/avatars/duckson.png';
import dicksonBaby from '../assets/avatars/dickson.png';
import sealyBaby from '../assets/avatars/sealy.png';

// Import TEENAGER stage avatars
import sharkwowTeenager from '../assets/avatars/sharkwow-teenager.png';
import squirtleTeenager from '../assets/avatars/squirtle-teenager.png';
import stitchTeenager from '../assets/avatars/stitch-teenager.png';
import ducksonTeenager from '../assets/avatars/duckson-teenager.png';
import dicksonTeenager from '../assets/avatars/dickson-teenager.png';
import sealyTeenager from '../assets/avatars/sealy-teenager.png';

// Import ADULT stage avatars
import sharkwowAdult from '../assets/avatars/sharkwow-adult.png';
import squirtleAdult from '../assets/avatars/squirtle-adult.png';
import stitchAdult from '../assets/avatars/stitch-adult.png';
import ducksonAdult from '../assets/avatars/duckson-adult.png';
import dicksonAdult from '../assets/avatars/dickson-adult.png';
import sealyAdult from '../assets/avatars/sealy-adult.png';

// Stage-based avatar mapping
const AVATAR_IMAGES: Record<string, Record<string, string>> = {
  Sharkwow: {
    [PetStage.BABY]: sharkwowBaby,
    [PetStage.TEENAGER]: sharkwowTeenager,
    [PetStage.ADULT]: sharkwowAdult,
  },
  Squirtle: {
    [PetStage.BABY]: squirtleBaby,
    [PetStage.TEENAGER]: squirtleTeenager,
    [PetStage.ADULT]: squirtleAdult,
  },
  Stitch: {
    [PetStage.BABY]: stitchBaby,
    [PetStage.TEENAGER]: stitchTeenager,
    [PetStage.ADULT]: stitchAdult,
  },
  Duckson: {
    [PetStage.BABY]: ducksonBaby,
    [PetStage.TEENAGER]: ducksonTeenager,
    [PetStage.ADULT]: ducksonAdult,
  },
  Dickson: {
    [PetStage.BABY]: dicksonBaby,
    [PetStage.TEENAGER]: dicksonTeenager,
    [PetStage.ADULT]: dicksonAdult,
  },
  Sealy: {
    [PetStage.BABY]: sealyBaby,
    [PetStage.TEENAGER]: sealyTeenager,
    [PetStage.ADULT]: sealyAdult,
  },
};

interface PetViewProps {
  type: PetType;
  stage: PetStage;
  isPetting: boolean;
  isEating: boolean;
  customImageUrl?: string;
}

export const PetView: React.FC<PetViewProps> = ({
  type,
  stage,
  isPetting,
  isEating,
  customImageUrl
}) => {
  // No size scaling - all stages same size
  const getSize = () => 'scale-100';

  const getEmoji = () => {
    return PET_EMOJIS[type] || '👶';
  };

  const getAuraColor = () => {
    switch (type) {
      case 'Sharkwow': return 'bg-cyan-400';
      case 'Squirtle': return 'bg-teal-400';
      case 'Stitch': return 'bg-indigo-400';
      case 'Duckson': return 'bg-yellow-400';
      case 'Dickson': return 'bg-amber-600';
      case 'Sealy': return 'bg-slate-300';
      default: return 'bg-pink-400';
    }
  };

  // Get stage-specific avatar, with fallback
  const getAvatarForStage = () => {
    const typeAvatars = AVATAR_IMAGES[type];
    if (!typeAvatars) return null;
    return typeAvatars[stage] || typeAvatars[PetStage.BABY];
  };

  // Use custom image, or fall back to stage-specific avatar
  const displayImage = customImageUrl || getAvatarForStage();

  return (
    <div className={`relative transition-all duration-500 transform ${getSize()} ${isPetting ? 'animate-bounce' : ''}`}>
      <div className="relative z-10 select-none flex items-center justify-center">
        {displayImage ? (
          <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white relative flex items-center justify-center">
            <img
              src={displayImage}
              alt="Pet Portrait"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="text-[10rem] filter drop-shadow-2xl">
            {getEmoji()}
          </div>
        )}
      </div>

      {isPetting && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-5xl animate-pulse z-20">
          ❤️
        </div>
      )}

      {isEating && (
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-5xl animate-bounce z-20">
          🍕
        </div>
      )}

      {/* Visual background aura */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-30 blur-3xl animate-pulse
        ${getAuraColor()}`}
      />
    </div>
  );
};
