import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary py-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-primary-foreground">Riverbank</span>
            </Link>
            <p className="text-primary-foreground/50 text-sm leading-relaxed">
            Zambia's leading digital loan comparison platform for civil servants.
            </p>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground text-sm mb-4">Platform</h4>
            <div className="space-y-2">
              <Link to="/compare" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">Compare Loans</Link>
              <Link to="/apply" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">Apply Now</Link>
              <Link to="/#how-it-works" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">How It Works</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground text-sm mb-4">Legal</h4>
            <div className="space-y-2">
              <Link to="/privacy" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">Terms of Service</Link>
              <Link to="/compliance" className="block text-primary-foreground/50 text-sm hover:text-accent transition-colors">Regulatory Compliance</Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground text-sm mb-4">Contact</h4>
            <div className="space-y-2 text-primary-foreground/50 text-sm">
              <p>support@riverbank.co.zm</p>
              <p>+260 211 000 000</p>
              <p>Lusaka, Zambia</p>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 text-center">
          <p className="text-primary-foreground/40 text-xs">
            © {new Date().getFullYear()} Riverbank. Regulated by the Bank of Zambia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
