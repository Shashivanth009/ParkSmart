
"use client";
import { useEffect, useState } from 'react';
import type { PaymentMethod } from '@/types';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { CreditCard, ShieldCheck, Trash2, PlusCircle, Edit3, AlertTriangle, CheckCircle, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';


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

  // formData includes all potential fields from the dialog
  const handleAddMethod = (formData: PaymentMethodFormData) => {
    const newMethodForState: PaymentMethod = {
        id: `pm${Date.now()}`,
        type: formData.type,
        details: formData.details, // This is the card nickname for cards, or UPI/Wallet ID
        isDefault: formData.isDefault,
        expiryDate: formData.type === 'card' ? formData.expiryDate : undefined,
    };
    // formData.actualCardNumber and formData.cvv are "sent to backend" but not stored in UI state
    console.log("Simulating sending to backend (not stored in UI state):", { actualCardNumber: formData.actualCardNumber, cvv: formData.cvv });


    if (newMethodForState.isDefault) {
        setPaymentMethods(prev => 
            [newMethodForState, ...prev.map(p => ({...p, isDefault: false}))]
        );
    } else {
        setPaymentMethods(prev => [newMethodForState, ...prev]);
    }
    toast({ title: "Payment Method Added", description: `${newMethodForState.details} has been saved.` });
    setIsAddDialogOpen(false);
  };

  const handleEditMethod = (updatedMethodData: PaymentMethodFormData, existingMethodId: string) => {
     const updatedMethodForState: PaymentMethod = {
        id: existingMethodId,
        type: updatedMethodData.type,
        details: updatedMethodData.details,
        isDefault: updatedMethodData.isDefault,
        expiryDate: updatedMethodData.type === 'card' ? updatedMethodData.expiryDate : undefined,
    };
    // updatedMethodData.actualCardNumber and updatedMethodData.cvv are "sent to backend"
    console.log("Simulating sending updated data to backend (not stored in UI state):", { actualCardNumber: updatedMethodData.actualCardNumber, cvv: updatedMethodData.cvv });

    setPaymentMethods(prev => {
        if (updatedMethodForState.isDefault) {
            return prev.map(p => p.id === existingMethodId ? updatedMethodForState : {...p, isDefault: false});
        }
        return prev.map(p => p.id === existingMethodId ? updatedMethodForState : p);
    });
    toast({ title: "Payment Method Updated", description: `${updatedMethodForState.details} has been updated.` });
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
            onSave={(data) => handleAddMethod(data)}
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
                                onSave={(data) => handleEditMethod(data, editingMethod.id)}
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

interface PaymentMethodFormData {
    type: PaymentMethod['type'];
    details: string; // For Card: nickname/label. For UPI/Wallet: actual ID/name.
    expiryDate?: string; // MM/YY format, only for card
    isDefault: boolean;
    actualCardNumber?: string; // Only for card, 12 digits
    cvv?: string; // Only for card, 3 digits
}

interface PaymentMethodFormDialogProps {
  title: string;
  description: string;
  paymentMethod?: PaymentMethod | null; // Existing method for editing
  onSave: (data: PaymentMethodFormData) => void;
  onClose: () => void;
  isOnlyMethod?: boolean;
}

function PaymentMethodFormDialog({ title, description, paymentMethod, onSave, onClose, isOnlyMethod }: PaymentMethodFormDialogProps) {
  const [type, setType] = useState<PaymentMethod['type']>(paymentMethod?.type || 'card');
  
  // For UPI/Wallet, 'detailsInput' holds the direct ID/name.
  // For Card, 'detailsInput' holds the nickname/label.
  const [detailsInput, setDetailsInput] = useState(paymentMethod?.details || '');
  
  const [actualCardNumber, setActualCardNumber] = useState(''); // Only for card type
  const [expiryDate, setExpiryDate] = useState(paymentMethod?.expiryDate || ''); // Only for card type
  const [cvv, setCvv] = useState(''); // Only for card type
  
  const [isDefault, setIsDefault] = useState(paymentMethod ? paymentMethod.isDefault : (isOnlyMethod || false));

  useEffect(() => {
    if (paymentMethod) {
        setType(paymentMethod.type);
        setDetailsInput(paymentMethod.details); // This is the nickname for cards
        setExpiryDate(paymentMethod.expiryDate || '');
        setIsDefault(paymentMethod.isDefault);
        // Card number and CVV are not pre-filled for editing for security
        setActualCardNumber('');
        setCvv('');
    } else {
        // Reset for add new
        setType('card');
        setDetailsInput('');
        setActualCardNumber('');
        setExpiryDate('');
        setCvv('');
        setIsDefault(isOnlyMethod || false);
    }
  }, [paymentMethod, isOnlyMethod]);


  const handleSubmit = () => {
    const dataToSave: PaymentMethodFormData = {
        type,
        details: detailsInput, // For card, this is the nickname. For others, the main detail.
        isDefault,
        expiryDate: type === 'card' ? expiryDate : undefined,
        actualCardNumber: type === 'card' ? actualCardNumber : undefined,
        cvv: type === 'card' ? cvv : undefined,
    };

    // Validation
    if (type === 'card') {
        if (!detailsInput.trim()) {
             toast({ title: "Validation Error", description: "Card nickname/label is required.", variant: "destructive" }); return;
        }
        if (!actualCardNumber || !/^\d{12}$/.test(actualCardNumber)) {
            toast({ title: "Validation Error", description: "Card number must be exactly 12 digits.", variant: "destructive" }); return;
        }
        if (!expiryDate || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate)) {
            toast({ title: "Validation Error", description: "Expiry date must be in MM/YY format.", variant: "destructive" }); return;
        }
        if (!cvv || !/^\d{3}$/.test(cvv)) {
            toast({ title: "Validation Error", description: "CVV must be exactly 3 digits.", variant: "destructive" }); return;
        }
    } else { // UPI or Wallet
        if (!detailsInput.trim()) {
            toast({ title: "Validation Error", description: (type === 'upi' ? "UPI ID" : "Wallet name") + " is required.", variant: "destructive" }); return;
        }
    }
    onSave(dataToSave);
  };

  return (
    <DialogContent className="sm:max-w-[550px]">
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

        {type === 'card' ? (
          <>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cardNickname" className="text-right col-span-1 text-sm">Nickname</Label>
              <Input id="cardNickname" value={detailsInput} onChange={(e) => setDetailsInput(e.target.value)} className="col-span-3" placeholder="e.g., My Visa ending 1234" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="actualCardNumber" className="text-right col-span-1 text-sm">Card Number</Label>
              <Input id="actualCardNumber" value={actualCardNumber} onChange={(e) => setActualCardNumber(e.target.value.replace(/\D/g, '').slice(0,12))} className="col-span-3" placeholder="12-digit card number" maxLength={12} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expiryDate" className="text-right col-span-1 text-sm">Expiry</Label>
                <Input id="expiryDate" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="col-span-3" placeholder="MM/YY" maxLength={5} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cvv" className="text-right col-span-1 text-sm">CVV</Label>
              <Input id="cvv" type="password" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0,3))} className="col-span-3" placeholder="3-digit CVV" maxLength={3} />
            </div>
            <Card className="col-span-4 bg-destructive/10 border-destructive/30">
                <CardContent className="p-3 text-xs text-destructive-foreground flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-destructive"/>
                    <div>
                        <strong>Security Note:</strong> For your protection, CVV numbers are used for immediate verification only and are never stored by our system. You will need to enter it for relevant future transactions if required by the gateway.
                    </div>
                </CardContent>
            </Card>
          </>
        ) : ( // UPI or Wallet
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="details" className="text-right col-span-1 text-sm">{type === 'upi' ? 'UPI ID' : 'Wallet Name'}</Label>
            <Input id="details" value={detailsInput} onChange={(e) => setDetailsInput(e.target.value)} className="col-span-3" placeholder={type === 'upi' ? "e.g. user@oksbi" : "e.g. Paytm Wallet"} />
          </div>
        )}
        
        <div className="flex items-center space-x-2 col-start-2 col-span-3 pt-2">
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

    