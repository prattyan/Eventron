export default function RefundPage() {
  return (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-6 animate-in fade-in duration-500">
      <h1 className="text-4xl sm:text-5xl font-black font-outfit text-white mb-8 tracking-tight">Refund & Cancellation Policy</h1>
      <div className="glass-card p-8 rounded-3xl text-slate-300 space-y-6 leading-relaxed">
        <p>This Refund & Cancellation Policy outlines the conditions under which refunds may be issued for event tickets purchased through Eventron.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">1. Organizer Policies</h3>
        <p>Refund policies are primarily determined by the individual event organizers. Please review the specific event details before purchasing. If an organizer has a "No Refund" policy, Eventron cannot override it.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">2. Platform Fees</h3>
        <p>In the event of a refund, Eventron platform fees are non-refundable unless the event is cancelled entirely by the organizer or the platform.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">3. Event Cancellations</h3>
        <p>If an event is cancelled by the organizer, attendees are entitled to a full refund of the ticket price (and platform fees, in most cases). Refunds will be automatically processed to the original payment method.</p>

        <h3 className="text-xl font-bold text-white mt-6">4. How to Request a Refund</h3>
        <p>If you are eligible for a refund, you must contact the event organizer directly through the platform. If you cannot reach the organizer within 7 days, you may escalate the request to Eventron support.</p>
      </div>
    </div>
  );
}
