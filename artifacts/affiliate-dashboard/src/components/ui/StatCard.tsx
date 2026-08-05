import React from 'react';
import { Card, CardContent } from './card';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, trend, prefix, suffix, delay = 0, subtitle }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="glass-panel hover:border-primary/30 transition-colors overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
              <h3 className="text-3xl font-display font-bold text-white">
                {prefix}{value}{suffix}
              </h3>
              {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <div className="p-3 bg-secondary rounded-xl text-primary">
              <Icon className="w-5 h-5" />
            </div>
          </div>
          
          {trend !== undefined && (
            <div className="mt-4 flex items-center text-sm">
              {trend >= 0 ? (
                <span className="text-emerald-500 flex items-center bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +{trend}%
                </span>
              ) : (
                <span className="text-destructive flex items-center bg-destructive/10 px-2 py-0.5 rounded-full">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {trend}%
                </span>
              )}
              <span className="text-muted-foreground ml-2">vs last month</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
