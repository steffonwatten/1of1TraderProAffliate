import React, { useState } from 'react';
import { useGetAdminApplications, useApproveApplication, useDenyApplication } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CheckCircle, XCircle, ExternalLink, Globe, MessageCircle } from 'lucide-react';
import { getGetAdminApplicationsQueryKey } from '@workspace/api-client-react';

export default function AdminApplications() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'denied'>('pending');
  const { data, isLoading } = useGetAdminApplications({ status: statusFilter });
  
  const queryClient = useQueryClient();
  const approveMut = useApproveApplication();
  const denyMut = useDenyApplication();

  const handleAction = (id: number, action: 'approve' | 'deny') => {
    const mutation = action === 'approve' ? approveMut : denyMut;
    mutation.mutate({ id, data: {} }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminApplicationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1">Review and manage partner applications.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-secondary/50 p-1 rounded-xl w-fit border border-white/5">
        {(['pending', 'approved', 'denied'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-6 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              statusFilter === status 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading && <div className="h-40 bg-secondary/50 animate-pulse rounded-xl" />}
        
        {!isLoading && data?.data.length === 0 && (
          <div className="text-center py-20 bg-card/30 rounded-xl border border-dashed border-white/10">
            <p className="text-muted-foreground">No {statusFilter} applications found.</p>
          </div>
        )}

        {data?.data.map((app) => (
          <Card key={app.id} className="glass-panel overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                
                {/* Left Col */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {app.fullName}
                        <Badge variant="outline" className="bg-secondary">{app.country}</Badge>
                      </h3>
                      <p className="text-muted-foreground text-sm">{app.email} • {app.phone}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Applied: {format(new Date(app.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-secondary/30 p-3 rounded-lg">
                      <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Audience</p>
                      <p className="font-medium text-white">{app.audienceType}</p>
                      <p className="text-primary">{app.communitySize} members</p>
                    </div>
                    <div className="bg-secondary/30 p-3 rounded-lg flex flex-col gap-2 justify-center">
                      {app.websiteUrl && <a href={app.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1"><Globe className="w-3 h-3"/> Website</a>}
                      {app.twitterUrl && <a href={app.twitterUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3"/> Twitter</a>}
                      {app.telegram && <span className="text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3"/> {app.telegram}</span>}
                    </div>
                  </div>
                </div>

                {/* Right Col / Long Text */}
                <div className="flex-1 space-y-4 md:border-l border-white/10 md:pl-6">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Traffic Strategy</p>
                    <p className="text-sm text-gray-300 line-clamp-2" title={app.trafficSources}>{app.trafficSources}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Trading Experience</p>
                    <p className="text-sm text-gray-300 line-clamp-2">{app.tradingExperience}</p>
                  </div>
                  
                  {statusFilter === 'pending' && (
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => handleAction(app.id, 'approve')}
                        className="flex-1 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border border-emerald-500/50"
                        disabled={approveMut.isPending || denyMut.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Approve
                      </Button>
                      <Button 
                        onClick={() => handleAction(app.id, 'deny')}
                        variant="outline" 
                        className="flex-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                        disabled={approveMut.isPending || denyMut.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Deny
                      </Button>
                    </div>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
