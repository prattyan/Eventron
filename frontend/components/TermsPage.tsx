export default function TermsPage() {
  return (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-6 animate-in fade-in duration-500">
      <h1 className="text-4xl sm:text-5xl font-black font-outfit text-white mb-8 tracking-tight">Terms and Conditions</h1>
      <div className="glass-card p-8 rounded-3xl text-slate-300 space-y-6 leading-relaxed">
        <p>Welcome to Eventron. By accessing or using our platform, you agree to be bound by these Terms and Conditions.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">1. Acceptance of Terms</h3>
        <p>By registering for an account, creating an event, or purchasing a ticket, you agree to comply with all applicable laws and these terms.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">2. User Responsibilities</h3>
        <p>Users must provide accurate information when creating an account and are responsible for maintaining the security of their credentials.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">3. Event Creation</h3>
        <p>Organizers are solely responsible for the events they create, including accuracy of details, fulfillment of promises, and compliance with local regulations.</p>

        <h3 className="text-xl font-bold text-white mt-6">4. Intellectual Property</h3>
        <p>All content on the Eventron platform, including logos, text, and design, is the property of Eventron or its licensors and is protected by copyright laws.</p>
      </div>
    </div>
  );
}
