
"use client";
import { useEffect, useState } from 'react';
import type { FavoriteLocation } from '@/types';
import { PageTitle } from '@/components/core/PageTitle';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { MapPin, Star, Trash2, Edit3, PlusCircle, Search, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';

const mockFavorites: FavoriteLocation[] = [
  { id: 'f1', name: 'Work Office Parking', address: '1 Business Rd, Downtown', notes: 'Usually P2, bay 23 is free.' },
  { id: 'f2', name: 'Weekend Mall Spot', address: '100 Shopping Ave, Uptown', spaceId: 'ps_mall_main' },
  { id: 'f3', name: 'Gym Parking', address: '20 Fitness Ln, Suburbia', notes: 'Covered area preferred.' },
];


export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingFavorite, setEditingFavorite] = useState<FavoriteLocation | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setFavorites(mockFavorites);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleAddFavorite = (newFav: Omit<FavoriteLocation, 'id'>) => {
    // Simulate API call
    const newFavoriteWithId = { ...newFav, id: `f${Date.now()}` };
    setFavorites(prev => [newFavoriteWithId, ...prev]);
    toast({ title: "Favorite Added", description: `${newFav.name} has been saved.`});
    setIsAddDialogOpen(false);
  };

  const handleEditFavorite = (updatedFav: FavoriteLocation) => {
    // Simulate API call
    setFavorites(prev => prev.map(f => f.id === updatedFav.id ? updatedFav : f));
    toast({ title: "Favorite Updated", description: `${updatedFav.name} has been updated.`});
    setEditingFavorite(null);
  };

  const handleDeleteFavorite = (id: string) => {
    // Simulate API call
    setFavorites(prev => prev.filter(f => f.id !== id));
    toast({ title: "Favorite Removed", variant: "destructive"});
  };

  const filteredFavorites = favorites.filter(fav => 
    fav.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    fav.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fav.notes && fav.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return <p className="text-center py-8">Loading favorite locations...</p>;
  }

  return (
    <div>
      <PageTitle title="Favorite Locations" description="Manage your saved parking spots for quick access.">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-5 w-5" /> Add New Favorite</Button>
          </DialogTrigger>
          <FavoriteFormDialog
            title="Add New Favorite"
            description="Save a new location for quick booking."
            onSave={(data) => handleAddFavorite(data)}
            onClose={() => setIsAddDialogOpen(false)}
          />
        </Dialog>
      </PageTitle>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground icon-glow" />
        <Input 
          placeholder="Search favorites by name, address, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredFavorites.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4 text-gray-500" />
            <p className="text-lg font-medium">No favorite locations found.</p>
            <p className="text-sm">{searchTerm ? "Try adjusting your search." : "Add some favorites to see them here!"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFavorites.map(fav => (
            <Card key={fav.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center">
                    <Star className="w-5 h-5 mr-2 text-accent icon-glow" />
                    {fav.name}
                  </CardTitle>
                  <div className="flex gap-1">
                     <Dialog open={editingFavorite?.id === fav.id} onOpenChange={(isOpen) => !isOpen && setEditingFavorite(null)}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingFavorite(fav)}>
                                <Edit3 className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                            </Button>
                        </DialogTrigger>
                        {editingFavorite?.id === fav.id && (
                            <FavoriteFormDialog
                                title="Edit Favorite"
                                description="Update the details for this favorite location."
                                favorite={editingFavorite}
                                onSave={handleEditFavorite}
                                onClose={() => setEditingFavorite(null)}
                            />
                        )}
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove &quot;{fav.name}&quot; from your favorites. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteFavorite(fav.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription className="flex items-center text-sm mt-1 pt-1 border-t">
                  <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground icon-glow flex-shrink-0" /> {fav.address}
                </CardDescription>
              </CardHeader>
              {fav.notes && (
                <CardContent className="flex-grow">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">&quot;{fav.notes}&quot;</p>
                </CardContent>
              )}
              <CardFooter>
                <Button className="w-full" asChild>
                  <Link href={fav.spaceId ? `/booking/${fav.spaceId}` : `/search?location=${encodeURIComponent(fav.address)}`}>
                    Find Parking Here
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


interface FavoriteFormDialogProps {
  title: string;
  description: string;
  favorite?: FavoriteLocation | null;
  onSave: (data: FavoriteLocation | Omit<FavoriteLocation, 'id'>) => void;
  onClose: () => void;
}

function FavoriteFormDialog({ title, description, favorite, onSave, onClose }: FavoriteFormDialogProps) {
  const [name, setName] = useState(favorite?.name || '');
  const [address, setAddress] = useState(favorite?.address || '');
  const [notes, setNotes] = useState(favorite?.notes || '');
  const [spaceId, setSpaceId] = useState(favorite?.spaceId || '');

  const handleSubmit = () => {
    if (!name || !address) {
      toast({ title: "Validation Error", description: "Name and Address are required.", variant: "destructive" });
      return;
    }
    const data = { name, address, notes, spaceId };
    if (favorite) {
      onSave({ ...favorite, ...data });
    } else {
      onSave(data);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="name" className="text-right col-span-1 text-sm">Name</label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., Work, Home" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="address" className="text-right col-span-1 text-sm">Address</label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="col-span-3" placeholder="Full address of the location" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="notes" className="text-right col-span-1 text-sm">Notes</label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" placeholder="Any specific details (e.g., best entrance, floor)" />
        </div>
         <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="spaceId" className="text-right col-span-1 text-sm">Space ID (Optional)</label>
          <Input id="spaceId" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="col-span-3" placeholder="Link to a specific parking space ID" />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" onClick={onClose}>Cancel</Button></DialogClose>
        <Button onClick={handleSubmit}>Save Favorite</Button>
      </DialogFooter>
    </DialogContent>
  );
}

