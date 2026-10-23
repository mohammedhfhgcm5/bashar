import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Org } from '../api'
import { Button, ErrorNote, Field, PageTitle, fieldClass } from '../components/ui'

const blank = { name: '', description: '', contactEmail: '', contactPhone: '' }

export function OrganizationsPage() {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [form, setForm] = useState(blank)
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: () => api<Org[]>('/api/organizations') })
  const create = useMutation({
    mutationFn: () => api('/api/organizations', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setForm(blank)
      setError('')
      await client.invalidateQueries({ queryKey: ['orgs'] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر الإنشاء'),
  })
  const toggle = useMutation({
    mutationFn: (org: Org) =>
      api(`/api/organizations/${org.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !org.isActive }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['orgs'] }),
  })

  return (
    <div className="space-y-6">
      <PageTitle title="المنظمات" subtitle="الجهات التي توزع المساعدة على البلاغات المعتمدة" />
      {error ? <ErrorNote message={error} /> : null}
      <form
        className="grid gap-3 surface p-5 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <Field label="الاسم"><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="البريد"><input className={fieldClass} type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} required /></Field>
        <Field label="الهاتف"><input className={fieldClass} value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} required /></Field>
        <Field label="الوصف"><input className={fieldClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <div className="md:col-span-2"><Button type="submit" disabled={create.isPending}>إضافة منظمة</Button></div>
      </form>
      <ul className="space-y-3">
        {(orgs.data ?? []).map((org) => (
          <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 surface px-4 py-3">
            <div>
              <p className="font-semibold">{org.name}</p>
              <p className="text-sm text-[#5e574e]">{org.contactEmail} · {org.contactPhone}</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => toggle.mutate(org)}>{org.isActive ? 'تعطيل' : 'تفعيل'}</Button>
          </li>
        ))}
      </ul>
      {orgs.data && orgs.data.length === 0 ? <p className="text-sm text-[#5e574e]">لا توجد منظمات بعد.</p> : null}
    </div>
  )
}
