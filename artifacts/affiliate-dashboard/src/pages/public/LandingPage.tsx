import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, TrendingUp, Users, Globe, DollarSign } from 'lucide-react';
import { useSubmitAffiliateApplication } from '@workspace/api-client-react';

const formSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required"),
  country: z.string().min(2, "Country is required"),
  telegram: z.string().optional(),
  discord: z.string().optional(),
  websiteUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
  twitterUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
  youtubeUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
  audienceType: z.string().min(2, "Required"),
  communitySize: z.string().min(1, "Required"),
  trafficSources: z.string().min(10, "Please provide more details"),
  whyJoin: z.string().min(10, "Please provide more details"),
  tradingExperience: z.string().min(2, "Required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function LandingPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const mutation = useSubmitAffiliateApplication();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate({ data }, {
      onSuccess: () => {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-[url('/images/hero-bg.png')] bg-cover bg-center opacity-40 mix-blend-screen pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="1OF1 Trader Pro"
            className="h-12 w-auto object-contain drop-shadow-[0_0_16px_rgba(251,191,36,0.35)]"
          />
        </div>
        <Link href="/login" className="text-sm font-medium text-white hover:text-primary transition-colors">
          Partner Login <ArrowRight className="inline w-4 h-4 ml-1" />
        </Link>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-32">
        {isSubmitted ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-12 text-center rounded-3xl"
          >
            <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-display font-bold text-white mb-4">You're Approved!</h1>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto mb-6">
              Welcome to the 1OF1 Trader Pro Partner Program. Your affiliate account is ready.
            </p>
            <div className="glass-panel border border-primary/30 rounded-2xl p-6 max-w-md mx-auto mb-8 text-left space-y-3">
              <p className="text-primary font-semibold text-sm uppercase tracking-widest">Next Steps</p>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
                <p className="text-muted-foreground text-sm">Check your email — your login credentials and referral link have been sent to you.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span>
                <p className="text-muted-foreground text-sm">Log in to your dashboard using the temporary password in the email.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">3</span>
                <p className="text-muted-foreground text-sm">Copy your referral link and start earning commissions right away.</p>
              </div>
            </div>
            <Link href="/login" className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-bold bg-primary text-black hover:bg-primary/90 transition-colors">
              Go to Login <ArrowRight className="inline w-4 h-4 ml-2" />
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="text-center mb-16">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-5xl md:text-7xl font-display font-extrabold text-white mb-6 leading-tight">
                  Partner with <br />
                  <span className="gold-gradient-text">1OF1 Trader Pro</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                  Join the elite community of Introducing Brokers and Affiliates. Earn industry-leading lifetime commissions by promoting the ultimate trading experience.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                  <DollarSign className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-bold text-white">High Commissions</h3>
                  <p className="text-sm text-muted-foreground mt-1">20–35% upfront &amp; monthly recurring</p>
                </div>
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                  <TrendingUp className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-bold text-white">Real-time Analytics</h3>
                  <p className="text-sm text-muted-foreground mt-1">Track every click & sale</p>
                </div>
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                  <Globe className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-bold text-white">Global Reach</h3>
                  <p className="text-sm text-muted-foreground mt-1">Convert worldwide</p>
                </div>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-panel border-0 shadow-2xl rounded-3xl overflow-hidden">
                <div className="bg-secondary/50 border-b border-white/5 p-8 text-center">
                  <h2 className="text-2xl font-display font-bold text-white">Submit Your Application</h2>
                  <p className="text-muted-foreground mt-2">Fill out the details below to request your partner account.</p>
                </div>
                <CardContent className="p-8 md:p-12">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    
                    {/* Basic Info */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-primary border-b border-white/10 pb-2">Personal Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Full Name <span className="text-destructive">*</span></Label>
                          <Input {...register("fullName")} className="bg-background/50 border-white/10" placeholder="John Doe" />
                          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Email <span className="text-destructive">*</span></Label>
                          <Input type="email" {...register("email")} className="bg-background/50 border-white/10" placeholder="john@example.com" />
                          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Phone <span className="text-destructive">*</span></Label>
                          <Input {...register("phone")} className="bg-background/50 border-white/10" placeholder="+1 234 567 8900" />
                          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Country <span className="text-destructive">*</span></Label>
                          <Input {...register("country")} className="bg-background/50 border-white/10" placeholder="United States" />
                          {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Social & Platforms */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-primary border-b border-white/10 pb-2">Platforms & Social</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Website URL</Label>
                          <Input {...register("websiteUrl")} className="bg-background/50 border-white/10" placeholder="https://" />
                          {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Twitter URL</Label>
                          <Input {...register("twitterUrl")} className="bg-background/50 border-white/10" placeholder="https://twitter.com/..." />
                          {errors.twitterUrl && <p className="text-sm text-destructive">{errors.twitterUrl.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>YouTube URL</Label>
                          <Input {...register("youtubeUrl")} className="bg-background/50 border-white/10" placeholder="https://youtube.com/..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Telegram Handle</Label>
                          <Input {...register("telegram")} className="bg-background/50 border-white/10" placeholder="@username" />
                        </div>
                      </div>
                    </div>

                    {/* Audience Info */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-primary border-b border-white/10 pb-2">Audience & Strategy</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Audience Type <span className="text-destructive">*</span></Label>
                          <Input {...register("audienceType")} className="bg-background/50 border-white/10" placeholder="e.g. Forex Traders, Crypto, Beginners" />
                          {errors.audienceType && <p className="text-sm text-destructive">{errors.audienceType.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Community Size <span className="text-destructive">*</span></Label>
                          <Select onValueChange={(val) => setValue('communitySize', val)}>
                            <SelectTrigger className="bg-background/50 border-white/10">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="< 1k">&lt; 1,000</SelectItem>
                              <SelectItem value="1k-10k">1,000 - 10,000</SelectItem>
                              <SelectItem value="10k-50k">10,000 - 50,000</SelectItem>
                              <SelectItem value="50k+">50,000+</SelectItem>
                            </SelectContent>
                          </Select>
                          {errors.communitySize && <p className="text-sm text-destructive">{errors.communitySize.message}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>How do you plan to promote 1OF1? <span className="text-destructive">*</span></Label>
                        <Textarea {...register("trafficSources")} className="bg-background/50 border-white/10 min-h-[100px]" placeholder="Describe your traffic sources and promotional strategies..." />
                        {errors.trafficSources && <p className="text-sm text-destructive">{errors.trafficSources.message}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Why do you want to partner with us? <span className="text-destructive">*</span></Label>
                        <Textarea {...register("whyJoin")} className="bg-background/50 border-white/10" />
                        {errors.whyJoin && <p className="text-sm text-destructive">{errors.whyJoin.message}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>Your Trading Experience <span className="text-destructive">*</span></Label>
                        <Textarea {...register("tradingExperience")} className="bg-background/50 border-white/10" />
                        {errors.tradingExperience && <p className="text-sm text-destructive">{errors.tradingExperience.message}</p>}
                      </div>
                    </div>

                    {mutation.isError && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl">
                        {mutation.error?.message || "An error occurred submitting your application. Please try again."}
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-background shadow-[0_0_30px_rgba(250,204,21,0.25)] hover:shadow-[0_0_40px_rgba(250,204,21,0.4)] transition-all duration-300 rounded-xl"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
