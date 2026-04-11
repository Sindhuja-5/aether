'use client';
import React from 'react';
import BlogCard from '@/components/BlogCard';

interface BlogGridProps {
  blogs: any[];
  onDelete?: (id: string) => void;
  hideStatusBadge?: boolean;
  hideAuthorActions?: boolean;
}

export function BlogGrid({ blogs, onDelete, hideStatusBadge, hideAuthorActions }: BlogGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-8">
      {blogs.map((blog: any) => (
        <BlogCard
          key={blog._id}
          blog={blog}
          onDelete={onDelete ? () => onDelete(blog._id) : undefined}
          hideStatusBadge={hideStatusBadge}
          hideAuthorActions={hideAuthorActions}
        />
      ))}
    </div>
  );
}
