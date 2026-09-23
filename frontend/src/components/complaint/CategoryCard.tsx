import React from 'react';
import {
  Droplets,
  UserCheck,
  ShieldAlert,
  Wrench,
  Clock,
  Navigation,
  Users,
  HeartHandshake,
  CreditCard,
  HelpCircle,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { CategoryMeta } from '../../lib/constants';
import { useLanguage } from '../../context/LanguageContext';

interface CategoryCardProps {
  category: CategoryMeta;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles: Droplets,
  Droplets,
  UserCheck,
  ShieldAlert,
  Wrench,
  Clock,
  Navigation,
  Users,
  HeartHandshake,
  CreditCard,
  HelpCircle,
};

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isSelected = false,
  onSelect,
  compact = false,
}) => {
  const { language } = useLanguage();
  const IconComponent = ICON_MAP[category.iconName] || HelpCircle;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left transition-all duration-150 rounded-[12px] p-4 border cursor-pointer select-none relative ${
        isSelected
          ? 'bg-[#ECEAE4] border-[#164E48]'
          : 'bg-white border-[#D9D7D0] hover:border-[#164E48]/60 hover:bg-[#ECEAE4]/40'
      }`}
    >
      {isSelected && (
        <span
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#D8FF3E] border border-[#164E48]"
          aria-hidden="true"
        />
      )}
      <div className="flex items-start gap-3.5">
        {/* Compact Icon */}
        <div
          className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? 'bg-[#164E48] text-white'
              : 'bg-[#ECEAE4] text-[#164E48] group-hover:bg-white'
          }`}
        >
          <IconComponent className="w-4 h-4 stroke-[2]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-bold text-[#171A19] leading-snug">
            {language === 'ml' ? category.labelMl : category.labelEn}
          </h4>

          <div className="text-[12px] text-[#6B706C] mt-0.5">
            {language === 'ml' ? category.labelEn : category.labelMl}
          </div>

          {!compact && (
            <p className="text-[13px] text-[#6B706C] mt-1.5 line-clamp-1 leading-normal">
              {language === 'ml' ? category.descriptionMl : category.descriptionEn}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};
