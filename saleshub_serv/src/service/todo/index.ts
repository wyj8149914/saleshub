import { TodoService } from './todo.service';
import { TodoTypeService } from './type.service';

const todoService = new TodoService();
const todoTypeService = new TodoTypeService();

export { todoService, todoTypeService };
