export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-white">OlkoCMS</span>
          <span className="text-gray-400 text-sm ml-2">Social Commerce</span>
        </div>
        <a href="/pricing" className="text-violet-400 hover:text-violet-300 text-sm">Pricing</a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: May 24, 2026</p>

        <div className="space-y-8 text-gray-300">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p className="leading-relaxed">OlkoCMS ("we", "our", or "us") operates a social commerce management platform that connects with Facebook, Instagram, and WhatsApp via Meta APIs. This Privacy Policy explains how we collect, use, and protect your information when you use our services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <div className="space-y-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-white font-medium mb-2">From Facebook/Instagram/WhatsApp:</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Sender ID and name of people who message your page</li>
                  <li>• Message content sent to your Facebook/Instagram page</li>
                  <li>• Timestamp of messages</li>
                  <li>• Page ID and platform information</li>
                </ul>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-white font-medium mb-2">From Business Users (CMS Admins):</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Name, email, and phone number</li>
                  <li>• Business name and details</li>
                  <li>• Order and customer data you enter</li>
                  <li>• Payment records</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-violet-400">•</span> To provide AI-powered auto-reply to your customers</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> To manage orders, messages, and follow-ups on your behalf</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> To generate business reports and analytics</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> To send notifications and reminders to your staff</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> To improve our AI models and service quality</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p className="leading-relaxed text-sm">All data is stored securely in encrypted PostgreSQL databases hosted on Neon (US East). We use industry-standard SSL/TLS encryption for all data in transit. Access to data is restricted to authorized staff only. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Facebook Data Usage</h2>
            <p className="leading-relaxed text-sm mb-3">We access Facebook data only through official Meta APIs with your explicit permission. Specifically:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-violet-400">•</span> We access your Page messages via Messenger Platform API</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> We only read messages sent TO your page, not personal messages</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> We use page_messaging permission only for sending automated replies</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Message data is stored for 90 days then automatically deleted</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> We comply with Meta Platform Terms and Developer Policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Sharing</h2>
            <p className="text-sm leading-relaxed">We do not share your data with third parties except:</p>
            <ul className="space-y-2 text-sm mt-2">
              <li className="flex gap-2"><span className="text-violet-400">•</span> Anthropic (Claude AI) — for generating AI replies, with no data retention</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Neon — database hosting provider</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Vercel — application hosting provider</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> When required by law or legal process</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-violet-400">•</span> Request access to your personal data</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Request correction of inaccurate data</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Request deletion of your data</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Withdraw consent at any time</li>
              <li className="flex gap-2"><span className="text-violet-400">•</span> Disconnect your Facebook page at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Data Retention</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 py-2">Data Type</th>
                    <th className="text-left text-gray-400 py-2">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr><td className="py-2 text-gray-300">Facebook Messages</td><td className="py-2 text-gray-400">90 days</td></tr>
                  <tr><td className="py-2 text-gray-300">Order Data</td><td className="py-2 text-gray-400">2 years</td></tr>
                  <tr><td className="py-2 text-gray-300">Account Data</td><td className="py-2 text-gray-400">Until account deletion</td></tr>
                  <tr><td className="py-2 text-gray-300">Payment Records</td><td className="py-2 text-gray-400">7 years (legal requirement)</td></tr>
                  <tr><td className="py-2 text-gray-300">Activity Logs</td><td className="py-2 text-gray-400">1 year</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact Us</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
              <p>For privacy-related questions or data deletion requests:</p>
              <div className="mt-3 space-y-1">
                <p><span className="text-gray-400">Email:</span> <a href="mailto:olkocms@gmail.com" className="text-violet-400">olkocms@gmail.com</a></p>
                <p><span className="text-gray-400">Response time:</span> Within 48 hours</p>
              </div>
            </div>
          </section>

        </div>
      </div>

      <footer className="border-t border-gray-800 px-6 py-6 text-center mt-8">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
          <a href="/privacy" className="hover:text-gray-300">Privacy Policy</a>
          <a href="/data-deletion" className="hover:text-gray-300">Data Deletion</a>
          <a href="/pricing" className="hover:text-gray-300">Pricing</a>
        </div>
        <p className="text-gray-600 text-xs mt-3">2026 OlkoCMS - Made with love in Nepal</p>
      </footer>
    </div>
  )
}