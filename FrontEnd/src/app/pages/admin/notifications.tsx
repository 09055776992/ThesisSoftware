export function AdminNotifications() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
            <p className="text-gray-600">System alerts and announcements</p>
          </div>
          <button className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg font-medium hover:bg-[#152e4a]">
            Send Notification
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="size-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">System Maintenance Scheduled</h3>
                  <span className="text-sm text-gray-500">2 hours ago</span>
                </div>
                <p className="text-gray-600 text-sm">
                  Platform will undergo scheduled maintenance on Saturday, 2AM - 4AM
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="size-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">New Scholarships Added</h3>
                  <span className="text-sm text-gray-500">5 hours ago</span>
                </div>
                <p className="text-gray-600 text-sm">
                  3 new scholarship opportunities have been published successfully
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="size-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="size-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">Pending Applications Alert</h3>
                  <span className="text-sm text-gray-500">1 day ago</span>
                </div>
                <p className="text-gray-600 text-sm">
                  38 scholarship applications are awaiting review
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
