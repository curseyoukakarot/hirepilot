// Bulk delete leads
router.delete('/leads', async (req, res) => {
  const ids = req.body.ids ?? [];
  if (!ids.length) return res.status(400).json({ error: 'No ids provided' });

  // Ensure user is authenticated
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Delete leads belonging to the user
  const { data: deletedRows, error } = await supabase
    .from('leads')
    .delete()
    .in('id', ids)
    .eq('user_id', userId)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });

  const deleted = (deletedRows || []).map(r => r.id);
  const notFound = ids.filter(id => !deleted.includes(id));

  res.status(200).json({ deleted, notFound });
}); 