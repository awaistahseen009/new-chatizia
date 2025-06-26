import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Bot, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Shield, 
  Search, 
  Filter,
  MoreVertical,
  Ban,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Database,
  Eye,
  Trash2,
  UserX,
  UserCheck,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AdminStats {
  totalUsers: number;
  totalChatbots: number;
  totalMessages: number;
  totalDocuments: number;
  activeUsers: number;
  blockedUsers: number;
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  subscription_status: string;
  created_at: string;
  last_login: string;
  email_verified: boolean;
  is_blocked?: boolean;
  chatbots_count?: number;
  messages_count?: number;
  documents_count?: number;
}

interface DocumentData {
  id: string;
  user_id: string;
  chatbot_id: string | null;
  filename: string;
  file_size: number;
  file_type: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processed_at: string | null;
  created_at: string;
  knowledge_base_id: string | null;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalChatbots: 0,
    totalMessages: 0,
    totalDocuments: 0,
    activeUsers: 0,
    blockedUsers: 0
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);

  // Check if user is admin
  const isAdmin = user?.email === 'admin@chatizia.com' || user?.subscription_status === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // Fetch users with additional data
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          chatbots:chatbots(count),
          conversations:conversations(count),
          documents:documents(count)
        `);

      if (usersError) throw usersError;

      // Fetch chatbots
      const { data: chatbotsData, error: chatbotsError } = await supabase
        .from('chatbots')
        .select(`
          *,
          users:user_id(email, full_name),
          conversations:conversations(count)
        `);

      if (chatbotsError) throw chatbotsError;

      // Fetch messages count
      const { count: messagesCount, error: messagesError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      if (messagesError) throw messagesError;

      // Fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select(`
          *,
          users:user_id(email, full_name),
          chatbots:chatbot_id(name)
        `);

      if (documentsError) throw documentsError;

      // Process users data
      const processedUsers = usersData?.map(user => ({
        ...user,
        chatbots_count: user.chatbots?.length || 0,
        messages_count: user.conversations?.length || 0,
        documents_count: user.documents?.length || 0,
        is_blocked: user.subscription_status === 'blocked'
      })) || [];

      setUsers(processedUsers);
      setChatbots(chatbotsData || []);
      setDocuments(documentsData || []);

      // Calculate stats
      const activeUsers = processedUsers.filter(u => !u.is_blocked).length;
      const blockedUsers = processedUsers.filter(u => u.is_blocked).length;

      setStats({
        totalUsers: processedUsers.length,
        totalChatbots: chatbotsData?.length || 0,
        totalMessages: messagesCount || 0,
        totalDocuments: documentsData?.length || 0,
        activeUsers,
        blockedUsers
      });

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId: string, block: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          subscription_status: block ? 'blocked' : 'free'
        })
        .eq('id', userId);

      if (error) throw error;

      await fetchAdminData();
      alert(`User ${block ? 'blocked' : 'unblocked'} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone and will delete all their data.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await fetchAdminData();
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      await fetchAdminData();
      alert('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && !user.is_blocked) ||
                         (filterStatus === 'blocked' && user.is_blocked);
    return matchesSearch && matchesFilter;
  });

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.users?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't Proprietà

System: You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'chatbots', label: 'Chatbots', icon: Bot },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
            </div>
            <div className="text-sm text-slate-600">
              Welcome, {user?.full_name || user?.email}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Users</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalUsers}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <span className="text-green-600">Active: {stats.activeUsers}</span>
                  <span className="text-red-600">Blocked: {stats.blockedUsers}</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Chatbots</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalChatbots}</p>
                  </div>
                  <Bot className="w-8 h-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Messages</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalMessages.toLocaleString()}</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Documents</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalDocuments}</p>
                  </div>
                  <FileText className="w-8 h-8 text-orange-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">System Health</p>
                    <p className="text-lg font-semibold text-green-600">Operational</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Database Size</p>
                    <p className="text-lg font-semibold text-slate-800">~{Math.round((stats.totalMessages + stats.totalDocuments) / 1000)}K Records</p>
                  </div>
                  <Database className="w-8 h-8 text-indigo-500" />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {users.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.full_name || user.email}</p>
                          <p className="text-sm text-slate-600">
                            {user.chatbots_count} chatbots • {user.documents_count} documents • {user.subscription_status}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-slate-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-slate-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            User
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Subscription
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Chatbots
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Documents
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Joined
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              {user.full_name || 'No name'}
                            </div>
                            <div className="text-sm text-slate-600">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.subscription_status === 'pro' ? 'bg-purple-100 text-purple-800' :
                            user.subscription_status === 'starter' ? 'bg-blue-100 text-blue-800' :
                            user.subscription_status === 'enterprise' ? 'bg-green-100 text-green-800' :
                            user.subscription_status === 'blocked' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.subscription_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {user.chatbots_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {user.documents_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              user.is_blocked ? 'bg-red-500' : 'bg-green-500'
                            }`}></div>
                            <span className="text-sm text-slate-600">
                              {user.is_blocked ? 'Blocked' : 'Active'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowUserModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBlockUser(user.id, !user.is_blocked)}
                              className={`${
                                user.is_blocked 
                                  ? 'text-green-600 hover:text-green-800' 
                                  : 'text-orange-600 hover:text-orange-800'
                              } transition-colors`}
                              title={user.is_blocked ? 'Unblock user' : 'Block user'}
                            >
                              {user.is_blocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Chatbots Tab */}
        {activeTab === 'chatbots' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Chatbot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Owner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Conversations
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {chatbots.map((chatbot) => (
                      <tr key={chatbot.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium mr-3"
                              style={{ backgroundColor: chatbot.configuration?.primaryColor || '#2563eb' }}
                            >
                              {chatbot.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-800">{chatbot.name}</div>
                              <div className="text-sm text-slate-600">{chatbot.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {chatbot.users?.email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            chatbot.status === 'active' ? 'bg-green-100 text-green-800' :
                            chatbot.status === 'inactive' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {chatbot.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {chatbot.conversations?.length || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(chatbot.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Documents</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Documents Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Owner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Chatbot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        File Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        File Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-800">{doc.filename}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {doc.users?.email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {doc.chatbots?.name || 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            doc.status === 'processed' ? 'bg-green-100 text-green-800' :
                            doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            doc.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {doc.file_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowDocumentModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">Messages Management</h3>
            <p className="text-slate-600">Detailed message management interface coming soon.</p>
          </div>
        )}

        {/* User Details Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800">User Details</h2>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <p className="text-slate-800">{selectedUser.full_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <p className="text-slate-800">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subscription</label>
                    <p className="text-slate-800 capitalize">{selectedUser.subscription_status}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <p className={`font-medium ${selectedUser.is_blocked ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedUser.is_blocked ? 'Blocked' : 'Active'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chatbots</label>
                    <p className="text-slate-800">{selectedUser.chatbots_count}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Documents</label>
                    <p className="text-slate-800">{selectedUser.documents_count}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Verified</label>
                    <p className={`font-medium ${selectedUser.email_verified ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedUser.email_verified ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Joined</label>
                    <p className="text-slate-800">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Login</label>
                    <p className="text-slate-800">
                      {selectedUser.last_login 
                        ? new Date(selectedUser.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      handleBlockUser(selectedUser.id, !selectedUser.is_blocked);
                      setShowUserModal(false);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.is_blocked
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {selectedUser.is_blocked ? 'Unblock User' : 'Block User'}
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteUser(selectedUser.id);
                      setShowUserModal(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Details Modal */}
        {showDocumentModal && selectedDocument && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800">Document Details</h2>
                  <button
                    onClick={() => setShowDocumentModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Filename</label>
                    <p className="text-slate-800">{selectedDocument.filename}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                    <p className="text-slate-800">{selectedDocument.users?.email || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chatbot</label>
                    <p className="text-slate-800">{selectedDocument.chatbots?.name || 'None'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <p className={`font-medium ${
                      selectedDocument.status === 'processed' ? 'text-green-600' :
                      selectedDocument.status === 'pending' ? 'text-yellow-600' :
                      selectedDocument.status === 'processing' ? 'text-blue-600' :
                      'text-red-600'
                    }`}>
                      {selectedDocument.status}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">File Type</label>
                    <p className="text-slate-800">{selectedDocument.file_type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">File Size</label>
                    <p className="text-slate-800">{(selectedDocument.file_size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Created</label>
                    <p className="text-slate-800">{new Date(selectedDocument.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Processed</label>
                    <p className="text-slate-800">
                      {selectedDocument.processed_at 
                        ? new Date(selectedDocument.processed_at).toLocaleDateString()
                        : 'Not processed'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Knowledge Base</label>
                    <p className="text-slate-800">{selectedDocument.knowledge_base_id || 'None'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      handleDeleteDocument(selectedDocument.id);
                      setShowDocumentModal(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete Document
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;