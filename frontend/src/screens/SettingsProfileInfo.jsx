import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import AdvancedInfoCard from '../components/settings/AdvancedInfoCard';
import ThemeToggle from '../components/settings/ThemeToggle';

export default function SettingsProfileInfo() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: ''
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPasswordPw, setCurrentPasswordPw] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setFormData({
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          email: user.email || '',
          company: user.user_metadata?.company || ''
        });
        setAvatarUrl(user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((user.user_metadata?.first_name || '') + ' ' + (user.user_metadata?.last_name || ''))}&background=random`);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (e) => {
    setFormData(prev => ({ ...prev, company: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Save name and company to user_metadata and users table
    await supabase.auth.updateUser({ data: { ...user.user_metadata, first_name: formData.firstName, last_name: formData.lastName, company: formData.company } });
    await supabase.from('users').update({ first_name: formData.firstName, last_name: formData.lastName, company: formData.company }).eq('id', user.id);
    setSaving(false);
    alert('Profile updated!');
  };

  const handleChangePhoto = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/storage/ensure-bucket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket: 'avatars' })
      });
    } catch {}
    const fileExt = file.name.split('.').pop();
    // Store inside a user-scoped folder to satisfy RLS policies like foldername(name)[1] = auth.uid()
    const filePath = `${user.id}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      alert(uploadError.message || 'Failed to upload avatar');
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;
    setAvatarUrl(publicUrl);
    await supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_url: publicUrl } });
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
    alert('Photo updated!');
  };

  const openEmailModal = () => {
    setNewEmail(formData.email);
    setCurrentPassword('');
    setEmailError('');
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailError('');
    setModalLoading(false);
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setEmailError('');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user) {
      setEmailError('User not found.');
      setModalLoading(false);
      return;
    }
    // Re-authenticate user (Supabase does not require re-auth for email change, but we can check password by signIn)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signInError) {
      setEmailError('Incorrect password.');
      setModalLoading(false);
      return;
    }
    // Update email
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });
    if (updateError) {
      setEmailError(updateError.message || 'Failed to update email.');
      setModalLoading(false);
      return;
    }
    await supabase.from('users').update({ email: newEmail }).eq('id', user.id);
    setFormData(prev => ({ ...prev, email: newEmail }));
    setShowEmailModal(false);
    setModalLoading(false);
    alert('Email updated! Please check your inbox to confirm the new email.');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    setPwLoading(true);
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      setPwLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPwError('User not found.');
      setPwLoading(false);
      return;
    }
    // Re-authenticate user
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPasswordPw });
    if (signInError) {
      setPwError('Incorrect current password.');
      setPwLoading(false);
      return;
    }
    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setPwError(updateError.message || 'Failed to update password.');
      setPwLoading(false);
      return;
    }
    setPwSuccess('Password updated successfully!');
    setShowPasswordModal(false);
    setPwLoading(false);
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
        <div className="space-y-6">
          {/* Appearance */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <ThemeToggle />
          </div>
          <div className="flex items-center space-x-6">
            <img 
              src={avatarUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover"
            />
            <button type="button" onClick={handleChangePhoto} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
              Change Photo
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-6">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input type="email" value={formData.email} readOnly className="w-full px-4 py-2 border rounded-md bg-gray-100 text-gray-500" />
              </div>
              <button type="button" onClick={openEmailModal} className="mb-1 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50">Edit</button>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <input type="text" name="company" value={formData.company} onChange={handleCompanyChange} placeholder="Add your company name" className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2 flex justify-end space-x-4 pt-6 border-t">
              <button type="button" onClick={() => setShowPasswordModal(true)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Change Password</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Email Edit Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Change Email</h3>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              {emailError && <div className="text-red-600 text-sm">{emailError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeEmailModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={modalLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {modalLoading ? 'Saving...' : 'Save Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" value={currentPasswordPw} onChange={e => setCurrentPasswordPw(e.target.value)} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              {pwError && <div className="text-red-600 text-sm">{pwError}</div>}
              {pwSuccess && <div className="text-green-600 text-sm">{pwSuccess}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={pwLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {pwLoading ? 'Saving...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Advanced Info Card */}
      <AdvancedInfoCard />
    </div>
  );
}
