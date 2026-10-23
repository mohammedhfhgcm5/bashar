import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Role, roleLabel } from '@damage/shared'
import { api, type ManagedUser, type Org } from '../api'
import { Button, ErrorNote, Field, PageTitle, fieldClass } from '../components/ui'

export function UsersPage() {
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: Role.SUPERVISOR as typeof Role.SUPERVISOR | typeof Role.ORGANIZATION,
    organizationId: '',
  })
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<ManagedUser[]>('/api/users') })
  const orgs = useQuery({ queryKey: ['orgs'], queryFn: () => api<Org[]>('/api/organizations') })
  const create = useMutation({
    mutationFn: () =>
      api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          organizationId: form.role === Role.ORGANIZATION ? form.organizationId : undefined,
        }),
      }),
    onSuccess: async () => {
      setError('')
      setForm({ fullName: '', email: '', phone: '', password: '', role: Role.SUPERVISOR, organizationId: '' })
      await client.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر الإنشاء'),
  })
  const toggle = useMutation({
    mutationFn: (user: ManagedUser) =>
      api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر التحديث'),
  })

  return (
    <div className="space-y-6">
      <PageTitle title="المستخدمون" subtitle="إنشاء حسابات المشرف والمنظمة" />
      {error ? <ErrorNote message={error} /> : null}
      <form
        className="grid gap-3 surface p-5 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <Field label="الاسم"><input className={fieldClass} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></Field>
        <Field label="البريد"><input className={fieldClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
        <Field label="الهاتف"><input className={fieldClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
        <Field label="كلمة المرور"><input className={fieldClass} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></Field>
        <Field label="الدور">
          <select className={fieldClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as typeof form.role })}>
            <option value={Role.SUPERVISOR}>مشرف</option>
            <option value={Role.ORGANIZATION}>منظمة</option>
          </select>
        </Field>
        {form.role === Role.ORGANIZATION ? (
          <Field label="المنظمة">
            <select className={fieldClass} value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })} required>
              <option value="">اختر منظمة</option>
              {(orgs.data ?? []).filter((org) => org.isActive).map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" disabled={create.isPending}>إنشاء الحساب</Button>
        </div>
      </form>
      <div className="overflow-hidden surface">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f1e8] text-[#5e574e]">
            <tr>
              <th className="px-4 py-3 text-right font-medium">الاسم</th>
              <th className="px-4 py-3 text-right font-medium">الدور</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-medium">{user.fullName}</div>
                  <div className="text-xs text-[#5e574e]">{user.email}{user.organization ? ` · ${user.organization.name}` : ''}</div>
                </td>
                <td className="px-4 py-3">{roleLabel[user.role]}</td>
                <td className="px-4 py-3">{user.isActive ? 'نشط' : 'معطّل'}</td>
                <td className="px-4 py-3">
                  <Button type="button" variant="ghost" onClick={() => toggle.mutate(user)}>{user.isActive ? 'تعطيل' : 'تفعيل'}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
