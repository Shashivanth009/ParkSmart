
"use client";

import { Header } from '@/components/core/Header';
import { Footer } from '@/components/core/Footer';
import { PageTitle } from '@/components/core/PageTitle';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import {
  Cpu,
  Wifi,
  CalendarCheck,
  CreditCard,
  ShieldCheck,
  Smile,
  BarChart3, // Using BarChart3 as BarChartBig might not exist or for variety
  Navigation as NavigationIcon, // Renaming to avoid conflict if Navigation component exists
  Leaf,
  Wrench,
  GitFork,
  ParkingSquare // For the conclusion or general theme
} from 'lucide-react';

interface FeatureSubItem {
  title: string;
  description: string;
}

interface FeatureItem {
  id: string;
  mainTitle: string;
  icon: LucideIcon;
  subItems: FeatureSubItem[];
}

const featuresData: FeatureItem[] = [
  {
    id: 'automated-solutions',
    mainTitle: '1) Automated Parking Solutions',
    icon: Cpu,
    subItems: [
      { title: 'a) Integration of Smart Parking Systems', description: 'Modern parking management systems leverage smart technologies to automate various processes. These systems integrate parking sensors and cameras to monitor occupancy, providing real-time data on available parking spaces. The information is then relayed to users through mobile apps or digital signage, streamlining the parking process.' },
      { title: 'b) IoT-based Parking Sensors', description: 'The Internet of Things (IoT) plays a crucial role in parking management. IoT-based parking sensors can detect vehicle presence and vacancy in real-time. They transmit this data to a centralized platform, enabling parking operators to manage their lots more efficiently and ensuring users can quickly find available parking spaces.' },
      { title: 'c) License Plate Recognition Technology', description: 'License plate recognition (LPR) technology allows seamless entry and exit from parking facilities. Cameras equipped with LPR technology can read license plate numbers, enabling automated access control without the need for physical tickets or tokens.' },
    ],
  },
  {
    id: 'real-time-availability',
    mainTitle: '2) Real-Time Parking Availability',
    icon: Wifi,
    subItems: [
      { title: 'a) Parking Space Monitoring', description: 'Parking management systems offer real-time monitoring of parking spaces, allowing users to access up-to-date information about available parking spots. This feature saves time and reduces frustration, as drivers can quickly locate a suitable parking space.' },
      { title: 'b) Mobile Applications for Parking Updates', description: 'Mobile apps have become indispensable tools for modern drivers. Parking management systems often come with user-friendly mobile applications that provide real-time parking updates, directions to available spots, and even the option to reserve parking spaces in advance.' },
      { title: 'c) Digital Signage and Parking Guidance Systems', description: 'Digital signage displays within parking facilities can guide drivers to vacant spaces efficiently. These interactive systems display the number of available spots on each level or aisle, making it easier for drivers to find parking quickly.' },
    ],
  },
  {
    id: 'online-booking',
    mainTitle: '3) Online Booking and Reservation',
    icon: CalendarCheck,
    subItems: [
      { title: 'a) Pre-booking Parking Spaces', description: 'Online booking and reservation systems allow users to secure parking spots in advance, ensuring a stress-free parking experience during peak hours or busy events. Pre-booking also benefits parking operators by predicting and managing demand.' },
      { title: 'b) Reservation Platforms and Apps', description: 'Various web-based reservation platforms and mobile apps enable users to book parking spaces remotely. These platforms usually support multiple payment options, making it convenient for users to secure their parking spot in just a few clicks.' },
      { title: 'c) QR Codes and E-Ticketing for Entry/Exit', description: 'Upon reservation, users receive QR codes or e-tickets that grant them access to the parking facility. This contactless entry and exit process enhance user convenience and reduce the need for physical tickets or passes.' },
    ],
  },
  {
    id: 'payment-billing',
    mainTitle: '4) Payment and Billing Systems',
    icon: CreditCard,
    subItems: [
      { title: 'a) Cashless Payment Options', description: 'Modern parking management systems promote cashless transactions, allowing users to pay for parking through various digital methods, such as credit cards, mobile wallets, or payment apps.' },
      { title: 'b) Mobile Payment Solutions', description: 'Mobile payment solutions enable users to pay for parking directly through their smartphones, simplifying the payment process and reducing the reliance on traditional payment methods.' },
      { title: 'c) Integration with Payment Gateways', description: 'Parking management systems often integrate with secure payment gateways, ensuring smooth and secure transactions for both users and parking operators.' },
    ],
  },
  {
    id: 'access-security',
    mainTitle: '5) Parking Access and Security',
    icon: ShieldCheck,
    subItems: [
      { title: 'a) Automated Entry/Exit Barriers', description: 'Automated entry and exit barriers are a fundamental part of parking management systems. These barriers operate based on user access control, whether through ticket scanning, license plate recognition, or mobile app authorization.' },
      { title: 'b) RFID and NFC Technologies', description: 'Radio Frequency Identification (RFID) and Near Field Communication (NFC) technologies are commonly used for contactless access control in parking facilities. Users can simply tap their RFID cards or NFC-enabled smartphones to gain entry.' },
      { title: 'c) Surveillance Cameras and Monitoring', description: 'To ensure parking security, surveillance cameras are strategically placed throughout parking facilities. These cameras help monitor vehicle movements, discourage illegal activities, and provide an added layer of safety for users and their vehicles.' },
    ],
  },
  {
    id: 'user-interface',
    mainTitle: '6) User-Friendly Interface',
    icon: Smile,
    subItems: [
      { title: 'a) Intuitive Mobile Apps and Websites', description: 'A user-friendly interface is crucial for enhancing the overall user experience. Parking management systems offer intuitive mobile apps and websites with easy-to-navigate features, making it convenient for users to access parking information.' },
      { title: 'b) Voice-Activated Parking Assistance', description: 'Innovative parking systems even include voice-activated parking assistants, enabling users to inquire about parking availability and receive real-time updates hands-free while driving.' },
      { title: 'c) Multilingual Support for Users', description: 'In multicultural environments, multilingual support in parking management systems caters to a diverse user base, ensuring all users can easily interact with the system.' },
    ],
  },
  {
    id: 'data-analytics',
    mainTitle: '7) Data Analytics and Insights',
    icon: BarChart3,
    subItems: [
      { title: 'a) Collection of Parking Data', description: 'Parking management systems collect valuable data, such as occupancy rates, peak hours, and user preferences. Analyzing this data provides valuable insights to optimize parking operations and enhance user experience.' },
      { title: 'b) Analyzing Parking Trends', description: 'By analyzing parking data, operators can identify trends and patterns, allowing them to make informed decisions about pricing, capacity planning, and resource allocation.' },
      { title: 'c) Improving Parking Infrastructure', description: 'Data-driven insights enable parking operators to identify areas for improvement and implement changes that optimize parking infrastructure and overall efficiency.' },
    ],
  },
  {
    id: 'navigation-integration',
    mainTitle: '8) Integration with Navigation Apps',
    icon: NavigationIcon,
    subItems: [
      { title: 'a) Seamless GPS Integration', description: 'Parking management systems can integrate with popular navigation apps to provide users with seamless directions to the nearest available parking spaces.' },
      { title: 'b) Real-Time Directions to Available Parking', description: 'Integration with navigation apps offers real-time updates on parking availability and directions, reducing traffic congestion and improving overall traffic flow.' },
      { title: 'c) Reducing Traffic Congestion', description: 'With users receiving real-time parking availability information through navigation apps, they can make informed decisions, reducing unnecessary traffic congestion caused by drivers searching for parking.' },
    ],
  },
  {
    id: 'sustainability',
    mainTitle: '9) Sustainability and Green Initiatives',
    icon: Leaf,
    subItems: [
      { title: 'a) Electric Vehicle (EV) Charging Stations', description: 'Parking management systems can include provisions for electric vehicle charging stations, promoting sustainability and encouraging the adoption of electric vehicles.' },
      { title: 'b) Eco-Friendly Parking Solutions', description: 'Some parking management systems implement eco-friendly features such as LED lighting, solar-powered facilities, and green building materials, reducing the environmental impact of parking operations.' },
      { title: 'c) Incentives for Carpooling', description: 'To further promote sustainability, parking management systems can offer incentives for carpooling, encouraging users to share rides and reduce the number of vehicles on the road.' },
    ],
  },
  {
    id: 'maintenance-support',
    mainTitle: '10) Maintenance and Support',
    icon: Wrench,
    subItems: [
      { title: 'a) Regular System Maintenance', description: 'Parking management systems require periodic maintenance to ensure seamless operation and prevent potential issues.' },
      { title: 'b) 24/7 Customer Support', description: 'A reliable customer support system provides assistance to users in case of any technical difficulties or inquiries, ensuring a positive experience.' },
      { title: 'c) Troubleshooting and Issue Resolution', description: 'Prompt troubleshooting and issue resolution are essential to minimize downtime and ensure continuous service availability.' },
    ],
  },
  {
    id: 'scalability-customization',
    mainTitle: '11) Scalability and Customization',
    icon: GitFork,
    subItems: [
      { title: 'a) Adapting to Different Parking Facilities', description: 'Parking management systems should be scalable and flexible enough to accommodate various types of parking facilities, including garages, lots, and on-street parking.' },
      { title: 'b) Modular Features for Custom Solutions', description: 'Modular features allow parking operators to tailor the system to meet their specific needs, ensuring a customized solution that fits their requirements.' },
      { title: 'c) Expansion and Future-Proofing', description: 'With technology evolving rapidly, parking management systems should be designed with the capacity for future expansion and integration of new features.' },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-8">
        <PageTitle
          title="ParkSmart Features Deep Dive"
          description="Explore the comprehensive capabilities that make ParkSmart a leading solution in modern parking management."
        />

        <Accordion type="multiple" className="w-full space-y-4">
          {featuresData.map((feature) => (
            <AccordionItem value={feature.id} key={feature.id} className="border bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <AccordionTrigger className="px-6 py-4 text-lg hover:no-underline">
                <div className="flex items-center gap-3">
                  <feature.icon className="h-6 w-6 text-primary icon-glow-primary" />
                  {feature.mainTitle}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-5">
                  {feature.subItems.map((subItem) => (
                    <div key={subItem.title} className="pl-2 border-l-2 border-primary/50">
                      <h4 className="font-semibold text-md text-foreground mb-1">{subItem.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{subItem.description}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Card className="mt-12 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ParkingSquare className="h-6 w-6 text-accent icon-glow" />Our Vision for Parking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              Parking management systems have transformed the way we approach parking. 
              While it is not necessary for a parking management system to have all the features listed above, 
              a suitable system will have the features that are most relevant to its users. 
              ParkSmart aims to incorporate many of these advanced features to provide a seamless experience. 
              Explore our app to see how we&apos;re making parking smarter!
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

    