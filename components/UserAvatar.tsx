import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  borderClassName?: string;
}

const sizeMap = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
};

const colorPalettes = [
  'bg-blue-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-cyan-500 text-white',
  'bg-teal-500 text-white',
  'bg-orange-500 text-white',
  'bg-sky-500 text-white',
];

function getColorByName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalettes[Math.abs(hash) % colorPalettes.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] || '?').toUpperCase();
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  borderClassName = '',
}) => {
  const [failed, setFailed] = useState(false);

  const sizeClass = sizeMap[size];
  const hasValidSrc = src && src.trim() !== '' && !failed;

  if (hasValidSrc) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ${borderClassName} ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  const colorClass = getColorByName(name);
  return (
    <div
      className={`${sizeClass} rounded-full ${colorClass} flex items-center justify-center font-semibold shrink-0 ${borderClassName} ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

export default UserAvatar;
