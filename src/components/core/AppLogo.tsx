import Link from 'next/link';
import { ParkingSquare } from 'lucide-react'; // Using a relevant icon

interface AppLogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
}

export function AppLogo({ className, iconSize = 28, textSize = "text-2xl" }: AppLogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-bold ${className}`}>
      <ParkingSquare size={iconSize} className="text-primary drop-shadow-glow-primary" />
      <span className={`${textSize} text-foreground`}>ParkSmart</span>
    </Link>
  );
}
