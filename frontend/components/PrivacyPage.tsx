export default function PrivacyPage() {
  return (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-6 animate-in fade-in duration-500">
      <h1 className="text-4xl sm:text-5xl font-black font-outfit text-white mb-8 tracking-tight">Privacy Policy</h1>
      <div className="glass-card p-8 rounded-3xl text-slate-300 space-y-6 leading-relaxed">
        <p>At Eventron, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">1. Information We Collect</h3>
        <p>We collect information you provide directly to us, such as when you create an account, register for an event, or communicate with us. This includes your name, email address, and payment information.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">2. How We Use Information</h3>
        <p>We use your information to provide, maintain, and improve our services, process transactions, and send you related information such as confirmations and updates.</p>
        
        <h3 className="text-xl font-bold text-white mt-6">3. Data Security</h3>
        <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, or disclosure. We use industry-standard encryption for data transmission.</p>

        <h3 className="text-xl font-bold text-white mt-6">4. Data Sharing</h3>
        <p>We do not sell your personal data. We may share necessary information with event organizers whose events you attend, strictly for event management purposes.</p>
      </div>
    </div>
  );
}
