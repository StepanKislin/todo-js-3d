(() => {
    'use strict';

    const STORAGE_KEYS = {
        lists: 'todoData',
        theme: 'theme'
    };

    const DEFAULT_LIST_TITLE = 'Список задач';
    const DEFAULT_THEME = 'dark';
    const MODAL_ANIMATION_MS = 300;
    const CONTAINER_WIDTH_GUARD = 420;
    const CONTAINER_HEIGHT_GUARD = 500;

    const state = {
        sceneContainer: null,
        listsContainer: null,
        buttons: {},
        modals: {},
        activeModalCleanup: null
    };

    const modalDefinitions = [
        {
            key: 'deleteList',
            id: 'delete-list-modal',
            title: 'Подтвердите удаление',
            message: ['Вы уверены, что хотите удалить этот список задач? Это действие нельзя отменить.'],
            cancelLabel: 'Отмена',
            confirmLabel: 'Удалить список'
        },
        {
            key: 'clearAll',
            id: 'clear-all-modal',
            title: 'Подтвердите действие',
            message: ['Вы уверены, что хотите удалить все задачи в этом списке? Это действие нельзя отменить.'],
            cancelLabel: 'Отмена',
            confirmLabel: 'Удалить все задачи'
        },
        {
            key: 'deleteAllLists',
            id: 'delete-all-lists-modal',
            title: 'Подтвердите удаление всех списков',
            message: ['Вы уверены, что хотите удалить ', { tag: 'strong', text: 'все списки задач' }, '? Это действие нельзя отменить.'],
            cancelLabel: 'Отмена',
            confirmLabel: 'Удалить все списки'
        }
    ];

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        buildAppShell();
        applySavedTheme();
        ensureTodoData();
        initGlobalEvents();
        initScene();
        renderSavedLists();
    }

    function buildAppShell() {
        state.sceneContainer = createElement('div', { id: 'scene-container' });
        state.buttons.themeToggle = createIconButton({
            id: 'theme-toggle-btn',
            className: 'theme-toggle-btn',
            label: 'Переключить тему',
            text: '🌓'
        });
        state.buttons.addList = createIconButton({
            id: 'add-list-btn',
            className: 'add-list-btn',
            label: 'Добавить список',
            text: '+'
        });
        state.buttons.deleteAllLists = createIconButton({
            id: 'delete-all-lists-btn',
            className: 'delete-all-lists-btn',
            label: 'Удалить все списки',
            text: '×'
        });
        state.listsContainer = createElement('div', { id: 'lists-container' });

        document.body.append(
            state.sceneContainer,
            state.buttons.themeToggle,
            state.buttons.addList,
            state.buttons.deleteAllLists,
            state.listsContainer
        );

        modalDefinitions.forEach((definition) => {
            const modal = createConfirmModal(definition);
            state.modals[definition.key] = modal;
            document.body.append(modal.element);
        });
    }

    function createIconButton({ id, className, label, text }) {
        return createElement('button', {
            id,
            className,
            type: 'button',
            text,
            attributes: {
                'aria-label': label,
                title: label
            }
        });
    }

    function createConfirmModal(definition) {
        const title = createElement('h3', {
            className: 'modal-title',
            text: definition.title
        });
        const message = createModalMessage(definition.message);
        const cancelButton = createElement('button', {
            className: 'modal-btn cancel-btn',
            type: 'button',
            text: definition.cancelLabel
        });
        const confirmButton = createElement('button', {
            className: 'modal-btn confirm-btn',
            type: 'button',
            text: definition.confirmLabel
        });
        const buttons = createElement('div', {
            className: 'modal-buttons',
            children: [cancelButton, confirmButton]
        });
        const content = createElement('div', {
            className: 'modal-content',
            children: [title, message, buttons]
        });
        const element = createElement('div', {
            id: definition.id,
            className: 'confirm-modal',
            children: [content],
            attributes: {
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': `${definition.id}-title`
            }
        });

        title.id = `${definition.id}-title`;

        return {
            element,
            confirmButton,
            cancelButton
        };
    }

    function createModalMessage(parts) {
        const message = createElement('p', { className: 'modal-message' });

        parts.forEach((part) => {
            if (typeof part === 'string') {
                message.append(document.createTextNode(part));
                return;
            }

            message.append(createElement(part.tag, { text: part.text }));
        });

        return message;
    }

    function createElement(tagName, options = {}) {
        const element = document.createElement(tagName);
        const {
            id,
            className,
            text,
            type,
            children,
            dataset,
            attributes,
            styles
        } = options;

        if (id) element.id = id;
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        if (type) element.type = type;

        Object.entries(dataset || {}).forEach(([key, value]) => {
            element.dataset[key] = value;
        });

        Object.entries(attributes || {}).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });

        Object.entries(styles || {}).forEach(([key, value]) => {
            element.style[key] = value;
        });

        (children || []).forEach((child) => {
            element.append(child);
        });

        return element;
    }

    function readJson(key, fallback) {
        const rawValue = localStorage.getItem(key);

        if (!rawValue) {
            return fallback;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function ensureTodoData() {
        if (!localStorage.getItem(STORAGE_KEYS.lists)) {
            saveLists({ lists: [], nextId: 1 });
        }
    }

    function getLists() {
        return normalizeTodoData(readJson(STORAGE_KEYS.lists, { lists: [], nextId: 1 }));
    }

    function saveLists(data) {
        writeJson(STORAGE_KEYS.lists, normalizeTodoData(data));
    }

    function normalizeTodoData(data) {
        const source = data && typeof data === 'object' ? data : {};
        const lists = Array.isArray(source.lists) ? source.lists : [];
        const nextId = Number.isInteger(source.nextId) && source.nextId > 0 ? source.nextId : 1;

        return {
            lists: lists
                .filter((list) => list && typeof list.id === 'string')
                .map((list) => ({
                    id: list.id,
                    title: typeof list.title === 'string' && list.title.trim() ? list.title : DEFAULT_LIST_TITLE,
                    position: normalizePosition(list.position)
                })),
            nextId
        };
    }

    function normalizePosition(position) {
        const x = Number(position?.x);
        const y = Number(position?.y);

        return {
            x: Number.isFinite(x) ? x : 20,
            y: Number.isFinite(y) ? y : 20
        };
    }

    function getTasks(listId) {
        const tasks = readJson(getTaskStorageKey(listId), []);

        if (!Array.isArray(tasks)) {
            return [];
        }

        return tasks
            .filter((task) => task && typeof task.text === 'string')
            .map((task) => ({
                text: task.text,
                completed: Boolean(task.completed)
            }));
    }

    function saveTasks(listId, tasks) {
        writeJson(getTaskStorageKey(listId), tasks);
    }

    function getTaskStorageKey(listId) {
        return `tasks_${listId}`;
    }

    function createList() {
        const data = getLists();
        const listId = `list_${data.nextId}`;
        const listTitle = data.lists.length === 0 ? DEFAULT_LIST_TITLE : `${DEFAULT_LIST_TITLE} ${data.lists.length + 1}`;
        const position = getNewListPosition();
        const newList = {
            id: listId,
            title: listTitle,
            position
        };

        data.nextId += 1;
        data.lists.push(newList);
        saveLists(data);

        return newList;
    }

    function getNewListPosition() {
        const containerRect = state.listsContainer.getBoundingClientRect();
        const maxX = Math.max(20, containerRect.width - CONTAINER_WIDTH_GUARD);
        const maxY = Math.max(20, containerRect.height - CONTAINER_HEIGHT_GUARD);

        return {
            x: Math.max(20, Math.min(maxX, 50 + Math.random() * maxX)),
            y: Math.max(20, Math.min(maxY, 50 + Math.random() * maxY))
        };
    }

    function renderSavedLists() {
        const data = getLists();

        if (data.lists.length === 0) {
            renderList(createList());
            return;
        }

        data.lists.forEach(renderList);
    }

    function renderList(list) {
        const container = createElement('section', {
            className: 'todo-container',
            dataset: { id: list.id },
            styles: {
                left: `${list.position.x}px`,
                top: `${list.position.y}px`
            }
        });
        const header = createListHeader(list);
        const form = createTaskForm();
        const taskList = createElement('ul', {
            id: `tasks-${list.id}`,
            className: 'task-list'
        });
        const scrollContainer = createElement('div', {
            className: 'tasks-scroll-container',
            children: [taskList]
        });
        const clearAllButton = createElement('button', {
            className: 'clear-all-btn',
            type: 'button',
            text: 'Очистить все задачи',
            dataset: { id: list.id }
        });

        container.append(header, form, scrollContainer, clearAllButton);
        state.listsContainer.append(container);

        renderTasks(list.id);
        initListEvents(container, list.id);
        initDragging(container);
    }

    function createListHeader(list) {
        const title = createElement('h2', {
            className: 'todo-title',
            text: list.title,
            attributes: {
                contenteditable: 'false'
            }
        });
        const deleteButton = createElement('button', {
            className: 'delete-list-btn',
            type: 'button',
            text: '×',
            dataset: { id: list.id },
            attributes: {
                'aria-label': 'Удалить список',
                title: 'Удалить список'
            }
        });

        return createElement('div', {
            className: 'todo-header',
            children: [title, deleteButton]
        });
    }

    function createTaskForm() {
        const input = createElement('input', {
            className: 'task-input',
            attributes: {
                placeholder: 'Новая задача...',
                required: '',
                autocomplete: 'off'
            }
        });
        const submitButton = createElement('button', {
            type: 'submit',
            text: '+',
            attributes: {
                'aria-label': 'Добавить задачу',
                title: 'Добавить задачу'
            }
        });

        input.type = 'text';

        return createElement('form', {
            className: 'todo-form',
            children: [input, submitButton]
        });
    }

    function renderTasks(listId) {
        const taskList = document.getElementById(`tasks-${listId}`);

        if (!taskList) {
            return;
        }

        const tasks = getTasks(listId);
        taskList.replaceChildren(...tasks.map(createTaskItem));
        updateClearAllButton(listId, tasks.length);
    }

    function createTaskItem(task, index) {
        const checkbox = createElement('input', {
            className: 'task-checkbox'
        });
        const text = createElement('span', {
            className: 'task-text',
            text: task.text
        });
        const deleteButton = createElement('button', {
            className: 'delete-btn',
            type: 'button',
            text: '×',
            dataset: { index },
            attributes: {
                'aria-label': 'Удалить задачу',
                title: 'Удалить задачу'
            }
        });
        const item = createElement('li', {
            className: `task-item${task.completed ? ' completed' : ''}`,
            children: [checkbox, text, deleteButton]
        });

        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;

        return item;
    }

    function updateClearAllButton(listId, taskCount) {
        const clearButton = document.querySelector(`.clear-all-btn[data-id="${listId}"]`);

        if (clearButton) {
            clearButton.disabled = taskCount === 0;
        }
    }

    function initListEvents(container, listId) {
        initTaskCreation(container, listId);
        initTaskListEvents(container, listId);
        initTitleEditing(container, listId);
        initListActions(container, listId);
    }

    function initTaskCreation(container, listId) {
        const form = container.querySelector('.todo-form');
        const input = container.querySelector('.task-input');

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const text = input.value.trim();

            if (!text) {
                return;
            }

            const tasks = getTasks(listId);
            tasks.push({ text, completed: false });
            saveTasks(listId, tasks);
            renderTasks(listId);
            input.value = '';
        });
    }

    function initTaskListEvents(container, listId) {
        const taskList = container.querySelector('.task-list');

        taskList.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-btn');

            if (!deleteButton) {
                return;
            }

            event.stopPropagation();
            deleteTask(listId, Number(deleteButton.dataset.index));
        });

        taskList.addEventListener('change', (event) => {
            if (!event.target.classList.contains('task-checkbox')) {
                return;
            }

            toggleTaskCompletion(listId, event.target);
        });
    }

    function deleteTask(listId, taskIndex) {
        if (!Number.isInteger(taskIndex)) {
            return;
        }

        const tasks = getTasks(listId);
        tasks.splice(taskIndex, 1);
        saveTasks(listId, tasks);
        renderTasks(listId);
    }

    function toggleTaskCompletion(listId, checkbox) {
        const item = checkbox.closest('li');
        const taskIndex = Array.from(item.parentElement.children).indexOf(item);
        const tasks = getTasks(listId);

        if (!tasks[taskIndex]) {
            return;
        }

        tasks[taskIndex].completed = checkbox.checked;
        saveTasks(listId, tasks);
        renderTasks(listId);
    }

    function initTitleEditing(container, listId) {
        const titleElement = container.querySelector('.todo-title');

        titleElement.addEventListener('dblclick', () => {
            titleElement.contentEditable = 'true';
            titleElement.classList.add('editable');
            titleElement.focus();
            selectElementText(titleElement);
        });

        titleElement.addEventListener('blur', () => {
            saveListTitle(listId, titleElement);
        });

        titleElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                titleElement.blur();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                restoreListTitle(listId, titleElement);
                titleElement.blur();
            }
        });
    }

    function selectElementText(element) {
        const range = document.createRange();
        const selection = window.getSelection();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function saveListTitle(listId, titleElement) {
        const newTitle = titleElement.textContent.trim() || DEFAULT_LIST_TITLE;
        const data = getLists();
        const listIndex = data.lists.findIndex((list) => list.id === listId);

        titleElement.contentEditable = 'false';
        titleElement.classList.remove('editable');
        titleElement.textContent = newTitle;

        if (listIndex === -1) {
            return;
        }

        data.lists[listIndex].title = newTitle;
        saveLists(data);
    }

    function restoreListTitle(listId, titleElement) {
        const data = getLists();
        const originalTitle = data.lists.find((list) => list.id === listId)?.title || DEFAULT_LIST_TITLE;

        titleElement.textContent = originalTitle;
    }

    function initListActions(container, listId) {
        container.querySelector('.delete-list-btn').addEventListener('click', (event) => {
            event.stopPropagation();
            showDeleteListConfirmation(listId);
        });

        container.querySelector('.clear-all-btn').addEventListener('click', (event) => {
            event.stopPropagation();

            if (getTasks(listId).length > 0) {
                showClearAllConfirmation(listId);
            }
        });
    }

    function initDragging(element) {
        const header = element.querySelector('.todo-header');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        header.addEventListener('pointerdown', startDrag);

        function startDrag(event) {
            const isMouseSecondaryButton = event.pointerType === 'mouse' && event.button !== 0;
            const isEditingTitle = event.target.classList.contains('todo-title') && event.target.isContentEditable;
            const isDoubleClickOnTitle = event.target.classList.contains('todo-title') && event.detail >= 2;

            if (isMouseSecondaryButton || event.target.closest('button') || isEditingTitle || isDoubleClickOnTitle) {
                return;
            }

            event.preventDefault();
            isDragging = true;

            const rect = element.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;

            element.style.zIndex = '1000';
            element.classList.add('dragging');

            document.addEventListener('pointermove', drag);
            document.addEventListener('pointerup', endDrag);
            document.addEventListener('pointercancel', endDrag);
        }

        function drag(event) {
            if (!isDragging) {
                return;
            }

            event.preventDefault();

            const containerRect = state.listsContainer.getBoundingClientRect();
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            const maxX = Math.max(0, containerRect.width - width);
            const maxY = Math.max(0, containerRect.height - height);
            const x = clamp(event.clientX - containerRect.left - offsetX, 0, maxX);
            const y = clamp(event.clientY - containerRect.top - offsetY, 0, maxY);

            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        }

        function endDrag() {
            if (!isDragging) {
                return;
            }

            isDragging = false;
            element.classList.remove('dragging');
            element.style.zIndex = '';
            saveListPosition(element);

            document.removeEventListener('pointermove', drag);
            document.removeEventListener('pointerup', endDrag);
            document.removeEventListener('pointercancel', endDrag);
        }
    }

    function saveListPosition(element) {
        const data = getLists();
        const listIndex = data.lists.findIndex((list) => list.id === element.dataset.id);

        if (listIndex === -1) {
            return;
        }

        data.lists[listIndex].position = {
            x: Number.parseInt(element.style.left, 10),
            y: Number.parseInt(element.style.top, 10)
        };
        saveLists(data);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function showDeleteListConfirmation(listId) {
        openConfirmation('deleteList', () => {
            deleteList(listId);
        });
    }

    function showClearAllConfirmation(listId) {
        openConfirmation('clearAll', () => {
            clearAllTasks(listId);
        });
    }

    function showDeleteAllConfirmation() {
        openConfirmation('deleteAllLists', deleteAllLists);
    }

    function openConfirmation(modalKey, onConfirm) {
        const modal = state.modals[modalKey];

        if (!modal) {
            return;
        }

        closeAllModals();
        cleanupActiveModalHandlers();

        const confirmHandler = (event) => {
            event.stopPropagation();
            onConfirm();
            closeModal(modal.element);
            cleanupActiveModalHandlers();
        };
        const cancelHandler = (event) => {
            event.stopPropagation();
            closeModal(modal.element);
            cleanupActiveModalHandlers();
        };

        modal.confirmButton.addEventListener('click', confirmHandler);
        modal.cancelButton.addEventListener('click', cancelHandler);
        state.activeModalCleanup = () => {
            modal.confirmButton.removeEventListener('click', confirmHandler);
            modal.cancelButton.removeEventListener('click', cancelHandler);
        };

        modal.element.classList.add('active');
        modal.cancelButton.focus();
    }

    function closeAllModals() {
        Object.values(state.modals).forEach((modal) => {
            closeModal(modal.element);
        });
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    function cleanupActiveModalHandlers() {
        if (!state.activeModalCleanup) {
            return;
        }

        state.activeModalCleanup();
        state.activeModalCleanup = null;
    }

    function deleteList(listId) {
        if (!listId) {
            return;
        }

        localStorage.removeItem(getTaskStorageKey(listId));

        const data = getLists();
        data.lists = data.lists.filter((list) => list.id !== listId);
        saveLists(data);

        const container = document.querySelector(`.todo-container[data-id="${listId}"]`);

        if (!container) {
            return;
        }

        container.classList.add('exiting');
        setTimeout(() => {
            container.remove();
        }, MODAL_ANIMATION_MS);
    }

    function clearAllTasks(listId) {
        if (!listId) {
            return;
        }

        saveTasks(listId, []);
        renderTasks(listId);
    }

    function deleteAllLists() {
        const taskKeys = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);

            if (key && key.startsWith('tasks_list_')) {
                taskKeys.push(key);
            }
        }

        taskKeys.forEach((key) => {
            localStorage.removeItem(key);
        });
        saveLists({ lists: [], nextId: 1 });

        state.listsContainer.querySelectorAll('.todo-container').forEach((container) => {
            container.classList.add('exiting');
        });

        setTimeout(() => {
            state.listsContainer.replaceChildren();
            renderList(createList());
        }, MODAL_ANIMATION_MS);
    }

    function initGlobalEvents() {
        state.buttons.addList.addEventListener('click', () => {
            renderList(createList());
        });

        state.buttons.deleteAllLists.addEventListener('click', () => {
            if (getLists().lists.length > 0) {
                showDeleteAllConfirmation();
            }
        });

        state.buttons.themeToggle.addEventListener('click', () => {
            const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
            applyTheme(nextTheme);
            localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
        });

        Object.values(state.modals).forEach((modal) => {
            modal.element.addEventListener('click', (event) => {
                if (event.target === modal.element) {
                    event.stopPropagation();
                    closeModal(modal.element);
                    cleanupActiveModalHandlers();
                }
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            closeAllModals();
            cleanupActiveModalHandlers();
        });
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
        applyTheme(savedTheme === 'light' ? 'light' : DEFAULT_THEME);
    }

    function applyTheme(theme) {
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(`theme-${theme}`);
    }

    function initScene() {
        if (!window.THREE) {
            state.sceneContainer.hidden = true;
            return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        const geometry = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 16);
        const material = new THREE.MeshPhongMaterial({
            color: 0x6c5ce7,
            emissive: 0x3d348b,
            emissiveIntensity: 0.4,
            shininess: 120,
            transparent: true,
            opacity: 0.9
        });
        const torusKnot = new THREE.Mesh(geometry, material);
        const ambientLight = new THREE.AmbientLight(0x8a8aff, 0.6);
        const pointLight = new THREE.PointLight(0xffffff, 1.2);

        renderer.setSize(window.innerWidth, window.innerHeight);
        state.sceneContainer.append(renderer.domElement);
        scene.add(torusKnot);
        scene.add(ambientLight);
        pointLight.position.set(3, 4, 5);
        scene.add(pointLight);
        camera.position.z = 4;

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animateScene(renderer, scene, camera, torusKnot);
    }

    function animateScene(renderer, scene, camera, torusKnot) {
        torusKnot.rotation.x += 0.003;
        torusKnot.rotation.y += 0.005;
        renderer.render(scene, camera);
        requestAnimationFrame(() => {
            animateScene(renderer, scene, camera, torusKnot);
        });
    }
})();
