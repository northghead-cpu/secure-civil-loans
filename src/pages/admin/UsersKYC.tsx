import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, CheckCircle2, XCircle } from "lucide-react";

const mockKYC = [
  { id: "1", name: "John Mwale", nrc: "123456/10/1", status: "pending", submitted: "2026-03-10", docs: 3 },
  { id: "2", name: "Grace Banda", nrc: "789012/67/1", status: "verified", submitted: "2026-03-09", docs: 4 },
  { id: "3", name: "Peter Zulu", nrc: "345678/90/1", status: "rejected", submitted: "2026-03-08", docs: 2 },
  { id: "4", name: "Mary Phiri", nrc: "567890/12/1", status: "pending", submitted: "2026-03-11", docs: 3 },
  { id: "5", name: "James Tembo", nrc: "111222/33/1", status: "verified", submitted: "2026-03-07", docs: 4 },
];

const statusBadge: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  verified: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const UsersKYC = () => {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">KYC Verification</h1>
        <p className="text-sm text-muted-foreground">Review and verify user identity documents</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-foreground">12</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-success">234</div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-display font-bold text-destructive">8</div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">KYC Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">NRC Number</TableHead>
                <TableHead className="hidden md:table-cell">Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockKYC.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{user.nrc}</TableCell>
                  <TableCell className="hidden md:table-cell">{user.docs} files</TableCell>
                  <TableCell>
                    <Badge className={statusBadge[user.status]}>{user.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{user.submitted}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-success"><CheckCircle2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive"><XCircle className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersKYC;
