import { useMemo, useState } from 'react'
import { Building2, Edit3, Layers3, Plus, Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ListPagination } from '@/components/ui/list-pagination'
import { createDepartment, createPosition, listDepartments, listPositions, updateDepartment, updatePosition } from '@/services/api'
import type { Department, Position } from '@/types/database'
import { usePagination } from '@/lib/use-pagination'

type CatalogForm = { id: string; name: string; description: string; department_id: string; is_active: boolean }
const emptyDepartment: CatalogForm = { id: '', name: '', description: '', department_id: '', is_active: true }
const emptyPosition: CatalogForm = { id: '', name: '', description: '', department_id: '', is_active: true }

export function OrganizationPage() {
  const queryClient = useQueryClient()
  const departments = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(true) })
  const positions = useQuery({ queryKey: ['positions', 'all'], queryFn: () => listPositions(true) })
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [positionSearch, setPositionSearch] = useState('')
  const [dialog, setDialog] = useState<'department' | 'position' | null>(null)
  const [form, setForm] = useState<CatalogForm>(emptyDepartment)
  const [error, setError] = useState('')
  const departmentMutation = useMutation({ mutationFn: (values: CatalogForm) => values.id ? updateDepartment(values.id, values) : createDepartment(values), onSuccess: () => { setDialog(null); void queryClient.invalidateQueries({ queryKey: ['departments'] }); void queryClient.invalidateQueries({ queryKey: ['employees'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const positionMutation = useMutation({ mutationFn: (values: CatalogForm) => values.id ? updatePosition(values.id, values) : createPosition(values), onSuccess: () => { setDialog(null); void queryClient.invalidateQueries({ queryKey: ['positions'] }); void queryClient.invalidateQueries({ queryKey: ['employees'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const filteredDepartments = useMemo(() => departments.data?.filter((item) => item.name.toLowerCase().includes(departmentSearch.toLowerCase())) ?? [], [departments.data, departmentSearch])
  const filteredPositions = useMemo(() => positions.data?.filter((item) => item.name.toLowerCase().includes(positionSearch.toLowerCase()) || item.department?.name.toLowerCase().includes(positionSearch.toLowerCase())) ?? [], [positions.data, positionSearch])
  const activeDepartments = departments.data?.filter((item) => item.is_active).length ?? 0
  const activePositions = positions.data?.filter((item) => item.is_active).length ?? 0

  function openDepartment(department?: Department) { setError(''); setForm(department ? { id: department.id, name: department.name, description: department.description ?? '', department_id: '', is_active: department.is_active } : emptyDepartment); setDialog('department') }
  function openPosition(position?: Position) { setError(''); setForm(position ? { id: position.id, name: position.name, description: position.description ?? '', department_id: position.department_id ?? '', is_active: position.is_active } : emptyPosition); setDialog('position') }
  function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (!form.name.trim()) { setError('A name is required.'); return } if (dialog === 'department') departmentMutation.mutate(form); else positionMutation.mutate(form) }

   return <div><PageHeading eyebrow="Organization" title="Departments and positions" description="Maintain the institutional structure used by employee assignments and payroll reporting." /><div className="mb-6 grid gap-3 sm:grid-cols-3"><CatalogMetric label="Departments" value={departments.data?.length ?? 0} detail={`${activeDepartments} active`} icon={Building2} /><CatalogMetric label="Positions" value={positions.data?.length ?? 0} detail={`${activePositions} active`} icon={Layers3} /><CatalogMetric label="Assignment catalog" value="Ready" detail="Used by employee profiles" icon={Edit3} /></div><div className="grid gap-6 xl:grid-cols-2"><Catalog title="Departments" icon={Building2} search={departmentSearch} onSearch={setDepartmentSearch} items={filteredDepartments} onAdd={() => openDepartment()} onEdit={openDepartment} onToggle={(item) => departmentMutation.mutate({ ...emptyDepartment, id: item.id, name: item.name, description: item.description ?? '', is_active: !item.is_active })} loading={departments.isLoading} error={departments.error as Error | null} kind="department" /><Catalog title="Positions" icon={Layers3} search={positionSearch} onSearch={setPositionSearch} items={filteredPositions} onAdd={() => openPosition()} onEdit={openPosition} onToggle={(item) => positionMutation.mutate({ ...emptyPosition, id: item.id, name: item.name, description: item.description ?? '', department_id: item.department_id ?? '', is_active: !item.is_active })} loading={positions.isLoading} error={positions.error as Error | null} kind="position" /></div>
    <Dialog open={dialog !== null} onClose={() => setDialog(null)} title={`${form.id ? 'Edit' : 'Add'} ${dialog === 'position' ? 'position' : 'department'}`} description="Referenced records are deactivated rather than deleted."><form onSubmit={submit} className="space-y-5">{error && <Alert variant="danger">{error}</Alert>}<div><Label>{dialog === 'position' ? 'Position name' : 'Department name'}</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></div><div><Label>Description</Label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>{dialog === 'position' && <div><Label>Department</Label><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))}><option value="">No department link</option>{departments.data?.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />Active record</label><div className="flex justify-end gap-2 border-t pt-5"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={departmentMutation.isPending || positionMutation.isPending}>Save changes</Button></div></form></Dialog>
  </div>
}

function Catalog<T extends Department | Position>({ title, icon: Icon, search, onSearch, items, onAdd, onEdit, onToggle, loading, error, kind }: { title: string; icon: typeof Building2; search: string; onSearch: (value: string) => void; items: T[]; onAdd: () => void; onEdit: (item: T) => void; onToggle: (item: T) => void; loading: boolean; error: Error | null; kind: 'department' | 'position' }) {
  const pagination = usePagination(items, search)
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle><CardDescription>{items.length} records in the catalog.</CardDescription></div><Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" />Add</Button></div><div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="pl-9" /></div></CardHeader><CardContent>{error && <Alert variant="danger" className="mb-4">{error.message}</Alert>}{loading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()}`} description={`Add your first ${kind}.`} /> : <><div className="space-y-2">{pagination.pageItems.map((item) => <div key={item.id} className="data-row-in flex flex-wrap items-center gap-3 rounded-lg border p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{item.name}</div><div className="truncate text-xs text-muted-foreground">{'department' in item && item.department ? item.department.name : item.description || 'No description'}</div></div><Badge variant={item.is_active ? 'success' : 'muted'}>{item.is_active ? 'Active' : 'Inactive'}</Badge><Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><Edit3 className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => onToggle(item)}>{item.is_active ? 'Deactivate' : 'Activate'}</Button></div>)}</div><ListPagination total={items.length} start={pagination.startIndex} end={pagination.endIndex} page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></>}</CardContent></Card>
}

function CatalogMetric({ label, value, detail, icon: Icon }: { label: string; value: number | string; detail: string; icon: typeof Building2 }) {
  return <Card className="p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div><div className="money text-xl font-black">{value}</div><div className="text-xs font-semibold">{label}</div><div className="text-[11px] text-muted-foreground">{detail}</div></div></div></Card>
}
