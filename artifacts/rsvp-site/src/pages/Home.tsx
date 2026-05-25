import * as React from "react";
import RsvpForm from "@/components/RsvpForm";
import { useGetSheetUrl } from "@workspace/api-client-react";

export default function Home() {
  const { data: sheetData } = useGetSheetUrl();

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background font-sans overflow-x-hidden selection:bg-primary/20">
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="absolute inset-0 w-full h-full opacity-60 mix-blend-multiply pointer-events-none">
          <img 
            src="/hero-floral.png" 
            alt="Romantic floral background" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="space-y-4">
            <p className="text-muted-foreground uppercase tracking-[0.3em] text-sm md:text-base font-medium">
              Please join us to celebrate the engagement of
            </p>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-foreground tracking-tight py-4">
              Eleanor & James
            </h1>
          </div>

          <div className="space-y-2 text-lg md:text-xl text-muted-foreground font-serif italic">
            <p>Saturday, August 16, 2025</p>
            <p>Seven o'clock in the evening</p>
            <p>The Conservatory at Rosewood Gardens</p>
          </div>
        </div>
      </section>

      {/* RSVP Section */}
      <section className="relative z-20 py-24 px-4 bg-background" id="rsvp">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <p className="font-serif text-2xl md:text-3xl text-foreground italic leading-relaxed">
              We would be honored to have you with us as we begin this new chapter.
            </p>
          </div>
          
          <RsvpForm />
        </div>
      </section>

      {/* Footer Section */}
      <footer className="py-20 px-4 text-center border-t border-border/40 mt-auto">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="font-serif text-3xl text-foreground">With love, E & J</h2>
          <p className="text-muted-foreground text-sm uppercase tracking-widest">
            Kindly respond by July 15, 2025
          </p>
          
          {sheetData?.url && (
            <div className="pt-12">
              <a 
                href={sheetData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                data-testid="link-sheet"
              >
                View Responses
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
