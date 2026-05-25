import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { appendRsvpRow } from "@/lib/googleSheets";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const rsvpSchema = z.object({
  name: z.string().min(1, "Please tell us your name."),
  email: z.string().email("Please enter a valid email address."),
  attending: z.boolean(),
  guestCount: z.coerce.number().min(1).max(10).optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});

type RsvpFormValues = z.infer<typeof rsvpSchema>;

export default function RsvpForm() {
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      name: "",
      email: "",
      attending: true,
      guestCount: 1,
      dietaryRestrictions: "",
      message: "",
    },
  });

  const watchAttending = form.watch("attending");

  const onSubmit = async (values: RsvpFormValues) => {
    setIsPending(true);
    setError(null);
    try {
      await appendRsvpRow(values);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      setError("There was an error submitting your RSVP. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 px-4 animate-in fade-in zoom-in duration-700">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2 className="text-3xl md:text-4xl font-serif text-primary" data-testid="status-success-title">
          Thank you for your response
        </h2>
        <p className="text-muted-foreground text-lg max-w-md" data-testid="status-success-message">
          We have received your RSVP and cannot wait to celebrate this special day with you.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-card p-8 md:p-10 rounded-2xl shadow-xl border border-card-border">
      <h2 className="text-3xl font-serif text-center text-foreground mb-8">RSVP</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Jane & John Doe" 
                      className="border-b-2 border-t-0 border-x-0 rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary text-lg" 
                      data-testid="input-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="jane@example.com" 
                      className="border-b-2 border-t-0 border-x-0 rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary text-lg" 
                      data-testid="input-email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attending"
              render={({ field }) => (
                <FormItem className="space-y-3 pt-4">
                  <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Will you be joining us?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(val) => field.onChange(val === "true")}
                      defaultValue={field.value ? "true" : "false"}
                      className="flex flex-col space-y-2"
                      data-testid="radio-attending"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="true" data-testid="radio-attending-yes" />
                        </FormControl>
                        <FormLabel className="font-normal text-lg cursor-pointer">
                          Joyfully accepts
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="false" data-testid="radio-attending-no" />
                        </FormControl>
                        <FormLabel className="font-normal text-lg cursor-pointer">
                          Regretfully declines
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchAttending && (
              <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-4">
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Number of Guests</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={10} 
                          className="border-b-2 border-t-0 border-x-0 rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary text-lg" 
                          data-testid="input-guest-count"
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dietaryRestrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Dietary Restrictions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please let us know of any allergies" 
                          className="resize-none border-b-2 border-t-0 border-x-0 rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary text-lg" 
                          data-testid="input-dietary"
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="pt-4">
                  <FormLabel className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Message to the Couple</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Share a memory, well wishes, or a song request" 
                      className="resize-none min-h-[100px] border-b-2 border-t-0 border-x-0 rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary text-lg" 
                      data-testid="input-message"
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {error && (
            <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="status-error">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-serif tracking-wide uppercase transition-all duration-300 hover:shadow-lg"
            disabled={isPending}
            data-testid="button-submit"
          >
            {isPending ? "Sending..." : "Send RSVP"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
