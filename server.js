import express from "express";
import bodyParser from "body-parser";
import { middleware } from "express-paginate";
import joi from "joi";

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(middleware(10, 50, { limitAlias: "count", pageAlias: "page" }));

import tasks from "./tasks.js";

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof joi.ValidationError) {
    const errors = err.details.map((e) => ({ message: e.message }));
    res.status(400).json({ error: "Validation failed", errors });
  } else {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const { limit, skip, sort, filter } = req.query;

    let filteredTasks = tasks;

    if (filter) {
      filteredTasks = tasks.filter((task) => {
        return (
          task.title.toLowerCase().includes(filter.toLowerCase()) ||
          task.description.toLowerCase().includes(filter.toLowerCase()) ||
          task.dueDate.includes(filter)
        );
      });
    }

    if (sort) {
      const [field, direction] = sort.split(":");
      filteredTasks.sort((a, b) => {
        if (field === "title" || field === "description") {
          return direction === "asc"
            ? a[field].localeCompare(b[field])
            : b[field].localeCompare(a[field]);
        } else if (field === "completed") {
          return direction === "asc"
            ? a.completed - b.completed
            : b.completed - a.completed;
        } else if (field === "dueDate") {
          const dateA = new Date(a.dueDate);
          const dateB = new Date(b.dueDate);
          return direction === "asc" ? dateA - dateB : dateB - dateA;
        }
        return 0;
      });
    }

    console.log("Filtered Tasks:", filteredTasks);

    const paginatedTasks = filteredTasks.slice(skip, skip + limit);
    const pageCount = Math.ceil(filteredTasks.length / limit);

    if (paginatedTasks.length === 0 && skip > 0) {
      return res
        .status(404)
        .json({ error: "No tasks found for the given page." });
    }

    res.status(200).json({
      tasks: paginatedTasks,
      pageCount,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/tasks/:id", (req, res) => {
  try {
    const taskId = req.params.id;
    const foundTask = tasks.find((task) => task.id === taskId);

    if (!foundTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(200).json(foundTask);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const taskSchema = joi.object({
  title: joi.string().required(),
  description: joi.string().required(),
  dueDate: joi.string(),
});

app.post("/tasks", async (req, res) => {
  try {
    const { error } = taskSchema.validate(req.body);
    if (error) {
      const errors = error.details.map((e) => ({ message: e.message }));
      return res.status(400).json({ error: "Validation failed", errors });
    }

    const { title, description, dueDate } = req.body;

    const newTask = {
      id: Date.now().toString(),
      title,
      description,
      dueDate,
      completed: false,
    };

    tasks.push(newTask);

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, dueDate, completed } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Title and description are required fields." });
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      title,
      description,
      dueDate,
      completed,
    };

    res.status(200).json(tasks[taskIndex]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const taskId = req.params.id;

    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];

    res.status(200).json({ message: "Task deleted successfully", deletedTask });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => console.log(`Server listening on port ${port}`));
