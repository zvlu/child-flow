import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, X, Edit2, Trash2, Phone, Mail, MapPin,
  Check, AlertCircle, ChevronRight, Home
} from "lucide-react";
import { toast } from "sonner";

interface FamilyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

interface FamilyManagementModalProps {
  familyId: number;
  familyName: string;
  contacts: FamilyContact[];
  onUpdate?: (contacts: FamilyContact[]) => void;
}

export function FamilyManagementModal({
  familyId,
  familyName,
  contacts: initialContacts,
  onUpdate,
}: FamilyManagementModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<FamilyContact[]>(initialContacts);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newContact, setNewContact] = useState<Partial<FamilyContact>>({
    name: "",
    relationship: "",
    phone: "",
    email: "",
    address: "",
    isPrimary: false,
  });

  const handleAddContact = () => {
    if (!newContact.name || !newContact.relationship) {
      toast.error("Please fill in name and relationship");
      return;
    }

    const contact: FamilyContact = {
      id: Date.now(),
      name: newContact.name || "",
      relationship: newContact.relationship || "",
      phone: newContact.phone || "",
      email: newContact.email || "",
      address: newContact.address || "",
      isPrimary: newContact.isPrimary || false,
    };

    if (newContact.isPrimary) {
      setContacts((prev) =>
        prev.map((c) => ({ ...c, isPrimary: false })).concat(contact)
      );
    } else {
      setContacts((prev) => [...prev, contact]);
    }

    setNewContact({
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      isPrimary: false,
    });
    toast.success("Contact added successfully");
  };

  const handleRemoveContact = (id: number) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contact removed");
  };

  const handleSetPrimary = (id: number) => {
    setContacts((prev) =>
      prev.map((c) => ({
        ...c,
        isPrimary: c.id === id,
      }))
    );
    toast.success("Primary contact updated");
  };

  const handleSave = () => {
    onUpdate?.(contacts);
    setIsOpen(false);
    toast.success("Family contacts updated successfully");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full gap-2 font-bold border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all">
          <Users className="h-4 w-4" /> Manage Family
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Family Management
          </DialogTitle>
          <DialogDescription className="font-bold text-slate-600">
            Manage contacts and addresses for {familyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Contacts */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Current Contacts ({contacts.length})
            </h3>

            {contacts.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {contacts.map((contact) => (
                  <Card key={contact.id} className="rounded-2xl border-slate-200 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-bold text-slate-900">{contact.name}</p>
                            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full text-xs font-bold">
                              {contact.relationship}
                            </Badge>
                            {contact.isPrimary && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full text-xs font-bold gap-1">
                                <Check className="h-3 w-3" /> Primary
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1 text-sm">
                            {contact.phone && (
                              <div className="flex items-center gap-2 text-slate-600 font-medium">
                                <Phone className="h-4 w-4 text-slate-400" /> {contact.phone}
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-slate-600 font-medium">
                                <Mail className="h-4 w-4 text-slate-400" /> {contact.email}
                              </div>
                            )}
                            {contact.address && (
                              <div className="flex items-start gap-2 text-slate-600 font-medium">
                                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" /> {contact.address}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!contact.isPrimary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(contact.id)}
                              className="rounded-lg font-bold text-xs hover:bg-primary/10 hover:text-primary transition-all"
                            >
                              Set Primary
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContact(contact.id)}
                            className="rounded-lg h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-all"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-bold">No contacts added yet</p>
              </div>
            )}
          </div>

          {/* Add New Contact */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Add New Contact
            </h3>

            <Card className="rounded-2xl border-slate-200 bg-slate-50/50">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Full Name"
                    value={newContact.name || ""}
                    onChange={(e) =>
                      setNewContact({ ...newContact, name: e.target.value })
                    }
                    className="rounded-lg border-slate-200 focus:border-primary focus:ring-primary font-bold"
                  />
                  <Input
                    placeholder="Relationship"
                    value={newContact.relationship || ""}
                    onChange={(e) =>
                      setNewContact({ ...newContact, relationship: e.target.value })
                    }
                    className="rounded-lg border-slate-200 focus:border-primary focus:ring-primary font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Phone Number"
                    value={newContact.phone || ""}
                    onChange={(e) =>
                      setNewContact({ ...newContact, phone: e.target.value })
                    }
                    className="rounded-lg border-slate-200 focus:border-primary focus:ring-primary font-bold"
                  />
                  <Input
                    placeholder="Email Address"
                    value={newContact.email || ""}
                    onChange={(e) =>
                      setNewContact({ ...newContact, email: e.target.value })
                    }
                    className="rounded-lg border-slate-200 focus:border-primary focus:ring-primary font-bold"
                  />
                </div>

                <Input
                  placeholder="Address"
                  value={newContact.address || ""}
                  onChange={(e) =>
                    setNewContact({ ...newContact, address: e.target.value })
                  }
                  className="rounded-lg border-slate-200 focus:border-primary focus:ring-primary font-bold"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={newContact.isPrimary || false}
                    onChange={(e) =>
                      setNewContact({ ...newContact, isPrimary: e.target.checked })
                    }
                    className="rounded-lg w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="isPrimary" className="font-bold text-sm text-slate-700 cursor-pointer">
                    Set as primary contact
                  </label>
                </div>

                <Button
                  onClick={handleAddContact}
                  className="w-full rounded-lg gap-2 font-bold shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" /> Add Contact
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1 rounded-lg font-bold border-slate-200 hover:bg-slate-100 transition-all"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 rounded-lg gap-2 font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Check className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
