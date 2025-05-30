import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from './avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  username?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  firstName,
  lastName,
  username,
  size = 'md',
  className
}) => {
  // Generate initials from first name and last name, or fallback to username
  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase();
    }
    if (username) {
      return username.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={`${firstName || username || 'User'} avatar`}
        />
      )}
      <AvatarFallback className="bg-blue-500 text-white font-medium">
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}; 