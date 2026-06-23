export default {
    // 用户列表，包含用户名和对应的权限等级
    userList: [
        {
            username: 'test-user4',
            level: 4,
        },
        {
            username: 'test-user3',
            level: 3,
        },
        {
            username: 'test-user2',
            level: 2,
        },
        {
            username: 'test-user1',
            level: 1,
        },
    ],

    // 权限等级定义
    roles: {
        admin: {
            level: 4,
            name: 'Admin',
            description: 'Full functionality permissions'
        },
        editor: {
            level: 3,
            name: 'Editor',
            description: 'Edit and view permissions'
        },
        user: {
            level: 2,
            name: 'User',
            description: 'Basic usage permissions'
        },
        viewer: {
            level: 1,
            name: 'Viewer',
            description: 'Read-only permissions'
        }
    },

    // 向后兼容的用户名列表
    get userNameList() {
        return this.userList.map(user => user.username);
    }
};
