"use client";
import { useEffect, useState } from 'react';
import type { PaymentMethod } from '@/types';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { CreditCard, ShieldCheck, Trash2, PlusCircle, Edit3, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


const mockPaymentMethods: PaymentMethod[] = [
  { id: 'pm1', type: 'card', details: 'Visa **** 1234', isDefault: true, expiryDate: '12/25' },
  { id: 'pm2', type: 'upi', details: 'yourname@okhdfcbank', isDefault: false },
  { id: 'pm3', type: 'wallet', details: 'Paytm Wallet', isDefault: false },
];

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setPaymentMethods(mockPaymentMethods);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleAddMethod = (newMethod: Omit<PaymentMethod, 'id'>) => {
    const newMethodWithId = { ...newMethod, id: `pm${Date.now()}` };
    if (newMethodWithId.isDefault) {
        setPaymentMethods(prev => 
            [newMethodWithId, ...prev.map(p => ({...p, isDefault: false}))]
        );
    } else {
        setPaymentMethods(prev => [newMethodWithId, ...prev]);
    }
    toast({ title: "Payment Method Added", description: `${newMethod.details} has been saved.` });
    setIsAddDialogOpen(false);
  };

  const handleEditMethod = (updatedMethod: PaymentMethod) => {
    setPaymentMethods(prev => {
        if (updatedMethod.isDefault) {
            return prev.map(p => p.id === updatedMethod.id ? updatedMethod : {...p, isDefault: false});
        }
        return prev.map(p => p.id === updatedMethod.id ? updatedMethod : p);
    });
    toast({ title: "Payment Method Updated", description: `${updatedMethod.details} has been updated.` });
    setEditingMethod(null);
  };

  const handleDeleteMethod = (id: string) => {
    const methodToDelete = paymentMethods.find(p => p.id === id);
    if(methodToDelete?.isDefault && paymentMethods.filter(p => p.id !== id).length > 0){
        toast({ title: "Cannot Delete", description: "Please set another method as default before deleting.", variant: "destructive" });
        return;
    }
    setPaymentMethods(prev => prev.filter(p => p.id !== id));
    toast({ title: "Payment Method Removed", variant: "destructive" });
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(prev => prev.map(p => ({...p, isDefault: p.id === id})));
    toast({ title: "Default Method Updated" });
  };


  if (isLoading) return <p className="text-center py-8">Loading payment methods...</p>;

  return (
    <div>
      <PageTitle title="Payment Methods" description="Manage your saved credit/debit cards, UPI, and wallets.">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-5 w-5" /> Add New Method</Button>
          </DialogTrigger>
          <PaymentMethodFormDialog
            title="Add New Payment Method"
            description="Securely save a new payment option."
            onSave={handleAddMethod}
            onClose={() => setIsAddDialogOpen(false)}
            isOnlyMethod={paymentMethods.length === 0}
          />
        </Dialog>
      </PageTitle>

      {paymentMethods.length === 0 ? (
         <div className="text-center py-10 text-muted-foreground">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-gray-500" />
            <p className="text-lg font-medium">No payment methods saved.</p>
            <p className="text-sm">Add a payment method to make bookings faster.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map(method => (
            <Card key={method.id} className={`shadow-md hover:shadow-lg transition-shadow ${method.isDefault ? 'border-primary border-2' : ''}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center">
                    <CreditCard className="w-6 h-6 mr-3 text-primary icon-glow-primary" />
                    {method.details}
                  </CardTitle>
                  <div className="flex gap-1 items-center">
                    {method.isDefault && <Badge variant="default" className="text-xs"><CheckCircle className="w-3 h-3 mr-1"/> Default</Badge>}
                    <Dialog open={editingMethod?.id === method.id} onOpenChange={(isOpen) => !isOpen && setEditingMethod(null)}>
                        <DialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingMethod(method)}><Edit3 className="h-4 w-4" /></Button>
                        </DialogTrigger>
                         {editingMethod?.id === method.id && (
                            <PaymentMethodFormDialog
                                title="Edit Payment Method"
                                description="Update your payment details."
                                paymentMethod={editingMethod}
                                onSave={handleEditMethod}
                                onClose={() => setEditingMethod(null)}
                                isOnlyMethod={paymentMethods.length === 1}
                            />
                         )}
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={method.isDefault && paymentMethods.length > 1}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will remove &quot;{method.details}&quot;. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteMethod(method.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription className="text-sm capitalize pt-1">{method.type} {method.expiryDate ? `- Expires ${method.expiryDate}` : ''}</CardDescription>
              </CardHeader>
              {!method.isDefault && (
                <CardFooter>
                  <Button variant="outline" size="sm" onClick={() => handleSetDefault(method.id)}>Set as Default</Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
      <Card className="mt-8 bg-secondary/50 border-dashed">
        <CardContent className="p-6 flex items-center gap-4">
            <ShieldCheck className="w-10 h-10 text-green-500 icon-glow" />
            <div>
                <h4 className="font-semibold">Your Security is Our Priority</h4>
                <p className="text-sm text-muted-foreground">We use industry-standard encryption to protect your payment information. Your full card details are never stored on our servers.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PaymentMethodFormDialogProps {
  title: string;
  description: string;
  paymentMethod?: PaymentMethod | null;
  onSave: (data: PaymentMethod | Omit<PaymentMethod, 'id'>) => void;
  onClose: () => void;
  isOnlyMethod?: boolean;
}

function PaymentMethodFormDialog({ title, description, paymentMethod, onSave, onClose, isOnlyMethod }: PaymentMethodFormDialogProps) {
  const [type, setType] = useState<PaymentMethod['type']>(paymentMethod?.type || 'card');
  const [details, setDetails] = useState(paymentMethod?.details || '');
  const [expiryDate, setExpiryDate] = useState(paymentMethod?.expiryDate || '');
  const [isDefault, setIsDefault] = useState(paymentMethod ? paymentMethod.isDefault : (isOnlyMethod || false));

  const handleSubmit = () => {
    if (!details) {
      toast({ title: "Validation Error", description: "Payment details are required.", variant: "destructive" });
      return;
    }
    if (type === 'card' && !expiryDate) {
      toast({ title: "Validation Error", description: "Expiry date is required for cards.", variant: "destructive" });
      return;
    }

    const data = { type, details, expiryDate: type === 'card' ? expiryDate : undefined, isDefault };
    if (paymentMethod) {
      onSave({ ...paymentMethod, ...data });
    } else {
      onSave(data);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="type" className="text-right col-span-1 text-sm">Type</Label>
          <Select value={type} onValueChange={(value: PaymentMethod['type']) => setType(value)}>
            <SelectTrigger className="col-span-3"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="wallet">Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="details" className="text-right col-span-1 text-sm">Details</Label>
          <Input id="details" value={details} onChange={(e) => setDetails(e.target.value)} className="col-span-3" placeholder={type === 'card' ? "Card Number (e.g. Visa **** 1234)" : type === 'upi' ? "UPI ID (e.g. user@oksbi)" : "Wallet Name (e.g. Paytm)"} />
        </div>
        {type === 'card' && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expiryDate" className="text-right col-span-1 text-sm">Expiry (MM/YY)</Label>
            <Input id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="col-span-3" placeholder="MM/YY" />
          </div>
        )}
        <div className="flex items-center space-x-2 col-start-2 col-span-3">
            <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} disabled={isOnlyMethod && paymentMethod?.isDefault}/>
            <Label htmlFor="isDefault">Set as default payment method</Label>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
        <Button onClick={handleSubmit}>Save Method</Button>
      </DialogFooter>
    </DialogContent>
  );
}
